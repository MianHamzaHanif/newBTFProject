import { ethers } from "ethers";
import V2PackageManagerABI from "./v2PackageManagerABI";
import {
  LegacyV2PackageManagerAddress,
  PackageManagerAddress,
  PackageMigrationSourceAddress,
} from "./address";
import { V1_MAINNET } from "./v1MainnetConfig";
import { createBscReadProvider } from "./readProvider";

const V1_PACKAGE_HISTORY_ABI = [
  "function getStakeHistoryLength(address user) view returns(uint256)",
  "function userStakeHistory(address user,uint256 index) view returns(uint256 packageValue,uint256 usdtAmount,uint256 tokenAmount,uint256 burnAmount,uint256 ownerLockAmount,uint256 userLockAmount,uint256 roiClaimed,uint256 timestamp)",
  "function getStakeIncomeStatus(address user,uint256 index) view returns(uint256 incomeLimit,uint256 usedIncome,uint256 remainingIncome,bool completed)",
  "function getStakeRoiInfo(address user,uint256 index) view returns(uint256 principal,uint256 maxRoi,uint256 totalAccrued,uint256 claimed,uint256 claimable,uint256 lastClaimAt)",
];

const PACKAGE_MIGRATION_SOURCE_ABI = [
  "function v1IndexRegistered(address user,uint256 index) view returns(bool)",
  "function v2IndexRegistered(address user,uint256 index) view returns(bool)",
];

const createV1ReadProvider = () => {
  const request = new ethers.FetchRequest(V1_MAINNET.rpcUrl);
  request.timeout = 30_000;
  return new ethers.JsonRpcProvider(request, V1_MAINNET.chainId, {
    staticNetwork: true,
    batchMaxCount: 1,
    batchStallTime: 0,
  });
};

const readInBatches = async (count, reader, batchSize = 10) => {
  const output = [];
  for (let start = 0; start < count; start += batchSize) {
    const indexes = Array.from({ length: Math.min(batchSize, count - start) }, (_, offset) => start + offset);
    output.push(...await Promise.all(indexes.map(reader)));
  }
  return output;
};

const keyOf = (record) => `${BigInt(record.amount ?? 0n)}:${BigInt(record.timestamp ?? 0n)}`;
const countRecords = (records) => records.reduce((counts, record) => {
  const key = keyOf(record);
  counts.set(key, (counts.get(key) || 0) + 1);
  return counts;
}, new Map());

const removeCovered = (records, coverage) => records.filter((record) => {
  const key = keyOf(record);
  const count = coverage.get(key) || 0;
  if (!count) return true;
  coverage.set(key, count - 1);
  return false;
});

export const incomeLimitForPackage = (amount) => {
  const value = BigInt(amount ?? 0n);
  if (value === ethers.parseEther("25")) return ethers.parseEther("75");
  if (value === ethers.parseEther("100")) return ethers.parseEther("500");
  if (value === ethers.parseEther("500")) return ethers.parseEther("3500");
  if (value === ethers.parseEther("1000")) return ethers.parseEther("10000");
  return 0n;
};

// Returns exactly the package rows that may appear in the UI. Priority is
// V3 -> V2 -> V1. The V3 migration source is authoritative for source-index
// suppression because V3 records use migration time as their purchasedAt.
export const loadPrioritizedPackageHistory = async (walletAddress) => {
  if (!ethers.isAddress(walletAddress)) throw new Error("Please connect your wallet.");

  const provider = createBscReadProvider();
  const source = new ethers.Contract(PackageMigrationSourceAddress, PACKAGE_MIGRATION_SOURCE_ABI, provider);
  const v1Manager = new ethers.Contract(V1_MAINNET.packageManager, V1_PACKAGE_HISTORY_ABI, createV1ReadProvider());
  const v2Manager = new ethers.Contract(LegacyV2PackageManagerAddress, V2PackageManagerABI, provider);
  const v3Manager = new ethers.Contract(PackageManagerAddress, V2PackageManagerABI, provider);

  const readV1 = async () => {
    const length = Number(await v1Manager.getStakeHistoryLength(walletAddress));
    return readInBatches(length, async (index) => {
      const [stake, income, roi, migratedToV3] = await Promise.all([
        v1Manager.userStakeHistory(walletAddress, index),
        v1Manager.getStakeIncomeStatus(walletAddress, index),
        v1Manager.getStakeRoiInfo(walletAddress, index),
        source.v1IndexRegistered(walletAddress, index).catch(() => false),
      ]);
      const amount = BigInt(stake.packageValue ?? stake[0] ?? 0n);
      const maximum = BigInt(roi.maxRoi ?? roi[1] ?? 0n);
      const generated = BigInt(roi.totalAccrued ?? roi[2] ?? 0n);
      const incomeLimit = BigInt(income.incomeLimit ?? income[0] ?? 0n);
      const usedIncome = BigInt(income.usedIncome ?? income[1] ?? 0n);
      const active = !Boolean(income.completed ?? income[3]);
      return {
        source: "V1", sourceIndex: index, amount,
        timestamp: BigInt(stake.timestamp ?? stake[7] ?? 0n), maximum, generated,
        incomeLimit, usedIncome, active, migratedToV3: Boolean(migratedToV3),
      };
    });
  };

  const readVersion = async (manager, version) => {
    const [lengthRaw, aggregateUsed] = await Promise.all([
      manager.getPackageHistoryLength(walletAddress),
      manager.totalIncomeUsed(walletAddress),
    ]);
    const length = Number(lengthRaw);
    return readInBatches(length, async (index) => {
      const [record, migratedToV3] = await Promise.all([
        manager.getPackageHistoryAt(walletAddress, index),
        version === "V2" ? source.v2IndexRegistered(walletAddress, index).catch(() => false) : false,
      ]);
      const amount = BigInt(record.amount ?? record[0] ?? 0n);
      const active = Boolean(record.active ?? record[5]);
      return {
        source: version, sourceIndex: index, amount,
        timestamp: BigInt(record.purchasedAt ?? record[1] ?? 0n),
        generated: BigInt(record.roiGenerated ?? record[3] ?? 0n),
        maximum: BigInt(record.roiMaximum ?? record[4] ?? 0n),
        incomeLimit: incomeLimitForPackage(amount),
        // Manager exposes aggregate usage. It is exact only where one package
        // exists; the summary deliberately does not invent per-package use.
        usedIncome: length === 1 ? BigInt(aggregateUsed ?? 0n) : null,
        aggregateUsed: BigInt(aggregateUsed ?? 0n),
        active,
        migratedToV3: Boolean(migratedToV3),
      };
    });
  };

  const [v1Result, v2Result, v3Result] = await Promise.allSettled([
    readV1(), readVersion(v2Manager, "V2"), readVersion(v3Manager, "V3"),
  ]);
  const failures = [];
  const v1 = v1Result.status === "fulfilled" ? v1Result.value : [];
  const v2 = v2Result.status === "fulfilled" ? v2Result.value : [];
  const v3 = v3Result.status === "fulfilled" ? v3Result.value : [];
  if (v1Result.status === "rejected") failures.push("V1 history could not be loaded");
  if (v2Result.status === "rejected") failures.push("V2 history could not be loaded");
  if (v3Result.status === "rejected") failures.push("V3 history could not be loaded");

  const visibleV2 = v2.filter((record) => !record.migratedToV3);
  const visibleV1Candidates = v1.filter((record) => !record.migratedToV3);
  // Pre-V3 V1 imports have original amount/timestamp retained in V2.
  const visibleV1 = removeCovered(visibleV1Candidates, countRecords(v2));
  const records = [...visibleV1, ...visibleV2, ...v3]
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
  return { records, failures };
};
