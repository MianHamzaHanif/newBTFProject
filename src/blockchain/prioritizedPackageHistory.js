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
  // V1 PackageManager returns exactly five fields. Declaring a sixth output
  // makes ethers reject every V1 row with a result-decoding error.
  "function getStakeRoiInfo(address user,uint256 index) view returns(uint256 principal,uint256 maxRoi,uint256 totalAccrued,uint256 claimed,uint256 claimable)",
];

const PACKAGE_MIGRATION_SOURCE_ABI = [
  "function v1IndexRegistered(address user,uint256 index) view returns(bool)",
  "function v2IndexRegistered(address user,uint256 index) view returns(bool)",
];

// The deployed legacy V2 Manager exposes the package-array length but its
// read-facet selector for `getPackageHistoryAt` is not routed. The array is
// still present in its immutable storage at this audited layout slot. Reading
// it directly is a normal `eth_getStorageAt` blockchain read—no events and no
// off-chain guessed data are used.
const LEGACY_V2_PACKAGE_HISTORY_SLOT = 78n;
const LEGACY_V2_PACKAGE_WORDS = 4n;
const LEGACY_V2_ORIGINAL_PURCHASED_AT_SLOT = 79n;
const LEGACY_V2_IS_LEGACY_PACKAGE_SLOT = 82n;
// This is the verified inherited-storage slot in the deployed V3 Manager.
// The currently deployed public length getter was compiled against an earlier
// layout, therefore it can return zero even though these rows are present.
const V3_PACKAGE_HISTORY_SLOT = 26n;
const PACKAGE_HISTORY_WORDS = 4n;

const packageArrayLocation = (walletAddress, slot) => ethers.keccak256(ethers.concat([
  ethers.zeroPadValue(walletAddress, 32),
  ethers.zeroPadValue(ethers.toBeHex(slot), 32),
]));

const readPackageHistoryLengthFromStorage = async (provider, managerAddress, walletAddress, slot) => BigInt(
  await provider.getStorage(managerAddress, packageArrayLocation(walletAddress, slot)),
);

const nestedMappingLocation = (walletAddress, slot, index) => ethers.keccak256(ethers.concat([
  ethers.zeroPadValue(ethers.toBeHex(BigInt(index)), 32),
  ethers.zeroPadValue(packageArrayLocation(walletAddress, slot), 32),
]));

const readLegacyV2PackageMeta = async (provider, walletAddress, index) => {
  const [originalPurchasedAt, isLegacy] = await Promise.all([
    provider.getStorage(
      LegacyV2PackageManagerAddress,
      nestedMappingLocation(walletAddress, LEGACY_V2_ORIGINAL_PURCHASED_AT_SLOT, index),
    ),
    provider.getStorage(
      LegacyV2PackageManagerAddress,
      nestedMappingLocation(walletAddress, LEGACY_V2_IS_LEGACY_PACKAGE_SLOT, index),
    ),
  ]);
  return { originalPurchasedAt: BigInt(originalPurchasedAt), isLegacy: BigInt(isLegacy) !== 0n };
};

const readPackageStorage = async (provider, managerAddress, walletAddress, index, slot) => {
  const mappingLocation = packageArrayLocation(walletAddress, slot);
  const base = BigInt(ethers.keccak256(mappingLocation));
  const rowStart = base + (BigInt(index) * PACKAGE_HISTORY_WORDS);
  const fields = await Promise.all(Array.from(
    { length: Number(PACKAGE_HISTORY_WORDS) },
    (_, offset) => provider.getStorage(
      managerAddress,
      ethers.toBeHex(rowStart + BigInt(offset)),
    ),
  ));
  const [amount, purchasedAt, deactivatedAt, roiMaximum] = fields.map((value) => BigInt(value));
  if (amount === 0n) throw new Error(`Legacy V2 package ${index} is empty`);
  return {
    amount,
    purchasedAt,
    deactivatedAt,
    roiGenerated: 0n,
    roiMaximum,
    active: deactivatedAt === 0n,
  };
};

const readLegacyV2PackageStorage = async (provider, walletAddress, index) => {
  const [record, meta] = await Promise.all([
    readPackageStorage(
      provider,
      LegacyV2PackageManagerAddress,
      walletAddress,
      index,
      LEGACY_V2_PACKAGE_HISTORY_SLOT,
    ),
    readLegacyV2PackageMeta(provider, walletAddress, index),
  ]);
  // A legacy V2 row retains its immutable V1 purchase time. This is the
  // exact on-chain V1→V2 identity link and is safer than matching tiers.
  return {
    ...record,
    purchasedAt: meta.isLegacy && meta.originalPurchasedAt !== 0n
      ? meta.originalPurchasedAt
      : record.purchasedAt,
    legacyV1Mirror: meta.isLegacy,
  };
};

const readV3PackageStorage = (provider, walletAddress, index) => readPackageStorage(
  provider,
  PackageManagerAddress,
  walletAddress,
  index,
  V3_PACKAGE_HISTORY_SLOT,
);

const createV1ReadProvider = () => {
  const request = new ethers.FetchRequest(V1_MAINNET.rpcUrl);
  request.timeout = 30_000;
  return new ethers.JsonRpcProvider(request, V1_MAINNET.chainId, {
    staticNetwork: true,
    batchMaxCount: 1,
    batchStallTime: 0,
  });
};

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// Public BSC RPC nodes occasionally drop one request in a batch on mobile
// networks. A single dropped request must not make the whole V1/V2/V3 history
// disappear from the activation table.
const readWithRetry = async (reader, index, attempts = 3) => {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await reader(index);
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await pause(350 * (attempt + 1));
    }
  }
  throw lastError;
};

const readInBatches = async (count, reader, batchSize = 10) => {
  const records = [];
  const failedIndexes = [];
  for (let start = 0; start < count; start += batchSize) {
    const indexes = Array.from({ length: Math.min(batchSize, count - start) }, (_, offset) => start + offset);
    const settled = await Promise.allSettled(indexes.map((index) => readWithRetry(reader, index)));
    settled.forEach((result, offset) => {
      if (result.status === "fulfilled") records.push(result.value);
      else failedIndexes.push(indexes[offset]);
    });
  }
  return { records, failedIndexes };
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
const sumBigInt = (records, field) => records.reduce(
  (total, record) => total + BigInt(record[field] ?? 0n), 0n
);

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
    // V1's public RPC endpoint throttles the four calls needed for each row
    // when several indexes are requested together. Read V1 one index at a
    // time so a user's old/inactive history is not dropped on mobile.
    const result = await readInBatches(length, async (index) => {
      const [stake, income, roi, migratedToV3] = await Promise.all([
        v1Manager.userStakeHistory(walletAddress, index),
        v1Manager.getStakeIncomeStatus(walletAddress, index),
        v1Manager.getStakeRoiInfo(walletAddress, index),
        source.v1IndexRegistered(walletAddress, index).catch(() => false),
      ]);
      const amount = BigInt(stake.packageValue ?? stake[0] ?? 0n);
      const maximum = BigInt(roi.maxRoi ?? roi[1] ?? 0n);
      const generated = BigInt(roi.totalAccrued ?? roi[2] ?? 0n);
      const claimable = BigInt(roi.claimable ?? roi[4] ?? 0n);
      const incomeLimit = BigInt(income.incomeLimit ?? income[0] ?? 0n);
      const usedIncome = BigInt(income.usedIncome ?? income[1] ?? 0n);
      const active = !Boolean(income.completed ?? income[3]);
      return {
        source: "V1", sourceIndex: index, amount,
        timestamp: BigInt(stake.timestamp ?? stake[7] ?? 0n), maximum, generated,
        claimable, incomeLimit, usedIncome,
        remainingIncome: BigInt(income.remainingIncome ?? income[2] ?? 0n),
        active, migratedToV3: Boolean(migratedToV3),
      };
    }, 1);
    return result;
  };

  const readVersion = async (manager, version) => {
    const storageSlot = version === "V2"
      ? LEGACY_V2_PACKAGE_HISTORY_SLOT
      : V3_PACKAGE_HISTORY_SLOT;
    const managerAddress = version === "V2"
      ? LegacyV2PackageManagerAddress
      : PackageManagerAddress;
    const [publicLengthRaw, storageLengthRaw, aggregateLimit, aggregateUsed, pendingSelfRoi, roiDay] = await Promise.all([
      manager.getPackageHistoryLength(walletAddress).catch(() => 0n),
      readPackageHistoryLengthFromStorage(provider, managerAddress, walletAddress, storageSlot),
      manager.totalIncomeLimit(walletAddress),
      manager.totalIncomeUsed(walletAddress),
      manager.pendingSelfRoi(walletAddress).catch(() => 0n),
      manager.ROI_DAY().catch(() => 0n),
    ]);
    // Direct storage is the authoritative count. The public V3 length getter
    // on this deployment can read the wrong inherited slot.
    const length = Number(storageLengthRaw > BigInt(publicLengthRaw)
      ? storageLengthRaw
      : publicLengthRaw);
    const history = await readInBatches(length, async (index) => {
      const [[record, legacyMeta], migratedToV3] = await Promise.all([
        Promise.all([
          (version === "V2"
            ? manager.getPackageHistoryAt(walletAddress, index).catch(() =>
              readLegacyV2PackageStorage(provider, walletAddress, index),
            )
            : readV3PackageStorage(provider, walletAddress, index)),
          // Even when V2's public history getter succeeds, it does not
          // expose the `isLegacyPackage` flag. Read the authoritative mapping
          // for every V2 index so a V1 migration mirror is never treated as
          // an independent native V2 purchase.
          version === "V2"
            ? readLegacyV2PackageMeta(provider, walletAddress, index)
            : Promise.resolve(null),
        ]),
        version === "V2" ? source.v2IndexRegistered(walletAddress, index).catch(() => false) : false,
      ]);
      const amount = BigInt(record.amount ?? record[0] ?? 0n);
      const active = Boolean(record.active ?? record[5]);
      const originalTimestamp = legacyMeta?.isLegacy && legacyMeta.originalPurchasedAt !== 0n
        ? legacyMeta.originalPurchasedAt
        : BigInt(record.purchasedAt ?? record[1] ?? 0n);
      return {
        source: version, sourceIndex: index, amount,
        timestamp: originalTimestamp,
        generated: BigInt(record.roiGenerated ?? record[3] ?? 0n),
        maximum: BigInt(record.roiMaximum ?? record[4] ?? 0n),
        incomeLimit: incomeLimitForPackage(amount),
        usedIncome: null,
        aggregateUsed: BigInt(aggregateUsed ?? 0n),
        active,
        legacyV1Mirror: Boolean(record.legacyV1Mirror || legacyMeta?.isLegacy),
        migratedToV3: Boolean(migratedToV3),
      };
    });
    let records = history.records;
    // Income consumes package limits in FIFO order. Allocate each Manager's
    // authoritative aggregate `totalIncomeUsed` across its actual package
    // indexes so the UI never repeats one aggregate on every row.
    if (version === "V2" || version === "V3") {
      let remainingUsed = BigInt(aggregateUsed ?? 0n);
      records = records.map((record) => {
        const usedIncome = remainingUsed > record.incomeLimit
          ? record.incomeLimit
          : remainingUsed;
        remainingUsed -= usedIncome;
        return { ...record, usedIncome };
      });
    }
    return {
      records,
      failedIndexes: history.failedIndexes,
      aggregateLimit: BigInt(aggregateLimit),
      aggregateUsed: BigInt(aggregateUsed),
      pendingSelfRoi: BigInt(pendingSelfRoi),
      roiDay: BigInt(roiDay),
    };
  };

  const [v1Result, v2Result, v3Result] = await Promise.allSettled([
    readV1(), readVersion(v2Manager, "V2"), readVersion(v3Manager, "V3"),
  ]);
  const failures = [];
  const v1Data = v1Result.status === "fulfilled" ? v1Result.value : { records: [], failedIndexes: [] };
  const v1 = v1Data.records;
  const emptyVersion = { records: [], failedIndexes: [], aggregateLimit: 0n, aggregateUsed: 0n, pendingSelfRoi: 0n, roiDay: 0n };
  const v2Data = v2Result.status === "fulfilled" ? v2Result.value : emptyVersion;
  const v3Data = v3Result.status === "fulfilled" ? v3Result.value : emptyVersion;
  const v2 = v2Data.records;
  const v3 = v3Data.records;
  // `v1IndexRegistered` is an explicit source-index registration in the V3
  // migration contract. It wins over purchase timestamps: V3 stores its own
  // import timestamp, while V1 retains the original purchase timestamp.
  const v1AlreadyInV3 = v1.filter((record) => record.migratedToV3);
  if (v1Result.status === "rejected") failures.push("V1 history could not be loaded");
  if (v2Result.status === "rejected") failures.push("V2 history could not be loaded");
  if (v3Result.status === "rejected") failures.push("V3 history could not be loaded");
  if (v1Data.failedIndexes.length) failures.push(`V1 package indexes ${v1Data.failedIndexes.join(", ")} could not be loaded`);
  if (v2Data.failedIndexes.length) failures.push(`V2 package indexes ${v2Data.failedIndexes.join(", ")} could not be loaded`);
  if (v3Data.failedIndexes.length) failures.push(`V3 package indexes ${v3Data.failedIndexes.join(", ")} could not be loaded`);

  // A source-registration flag alone is not proof that the destination row
  // is currently readable. A prior interrupted/manual migration can leave a
  // flag set while V3 history has no corresponding package row. Therefore a
  // lower-priority record is hidden only by an *actual* higher-priority row.
  // Legacy imports retain amount + original purchasedAt, making this a stable
  // key: V3 -> V2 -> V1, for both active and inactive packages.
  // Imported V2 rows are stored by V3 in import order, but V3 deliberately
  // stores the import block time rather than the old purchase time. Pair each
  // such row by its immutable amount and its source registration flag. This
  // removes the V2 mirror without requiring logs/events and without hiding a
  // separately purchased V3 package.
  // Some V1->V2 bridge rows were imported into V3 through the V1 snapshot
  // path, so their `v2IndexRegistered` flag is intentionally false. They
  // are nevertheless the exact V2 continuation when their immutable V1
  // timestamp+amount is V3-registered. Include them for display-field
  // restoration and de-duplication.
  const migratedV2 = v2.filter((record) => (
    record.migratedToV3
    || (record.legacyV1Mirror && v1AlreadyInV3.some((v1Record) => (
      v1Record.timestamp === record.timestamp
      && v1Record.amount === record.amount
    )))
  ));
  const pairedV2Indexes = new Set();
  // Legacy imports are written into V3 in migration order: first any V1
  // source rows, then the registered V2 rows.  The old code started pairing
  // V2 at V3 row zero, which shifted every pair whenever a V1 row existed
  // (and could display an already-imported V2 100 package twice).
  const v1ImportPrefixLength = v1AlreadyInV3.length;
  const v3WithSource = v3.map((record) => {
    // Migration ran before normal V3 buying was enabled; only this prefix can
    // represent legacy imports. A later native V3 buy of the same tier must
    // remain an independent package.
    const v2ImportPosition = record.sourceIndex - v1ImportPrefixLength;
    // This V3 prefix is a V1-origin migration. Keep it for package history,
    // but mark its lineage so Dashboard capital does not treat it as a new
    // V2/V3 investment.
    if (v2ImportPosition < 0) {
      const v1Source = v1AlreadyInV3[record.sourceIndex];
      // Older V3 migration rows retain amount but can have zero ROI display
      // fields. Restore the immutable V1 package values so Activation cards
      // keep the correct 3x target and ROI progress without adding a second
      // V1 row.
      if (v1Source && v1Source.amount === record.amount) {
        return {
          ...record,
          legacyV1Mirror: true,
          // V3 stores the import block time.  For a migrated package the
          // activation table must retain the original V1 purchase time.
          timestamp: v1Source.timestamp,
          maximum: record.maximum === 0n ? v1Source.maximum : record.maximum,
          generated: record.generated === 0n ? v1Source.generated : record.generated,
        };
      }
      return { ...record, legacyV1Mirror: true };
    }
    if (v2ImportPosition >= migratedV2.length) return record;
    const expected = migratedV2[v2ImportPosition];
    // Source ordering is authoritative.  The amount check is retained as a
    // safety guard so a later native V3 buy is never paired with legacy data.
    const matched = expected && !pairedV2Indexes.has(expected.sourceIndex)
      && expected.amount === record.amount
      ? expected
      : null;
    if (!matched) return record;
    pairedV2Indexes.add(matched.sourceIndex);
    // The deployed V3 migration preserves the package/cap state, but older
    // imported rows can have zeroed per-package self-ROI display fields.
    // Keep V3 as the authoritative package row and restore only those zero
    // display values from its matched V2 continuation.
    return {
      ...record,
      migratedV2Index: matched.sourceIndex,
      legacyV1Mirror: Boolean(matched.legacyV1Mirror),
      // This is an imported V2 package, not a new V3 purchase.  Preserve its
      // original purchase timestamp rather than displaying migration time.
      timestamp: matched.timestamp,
      maximum: record.maximum === 0n ? matched.maximum : record.maximum,
      // V3's compact history storage keeps the ROI maximum but not the
      // legacy generated amount. Restore it independently of `maximum`;
      // otherwise ROI progress shows an artificially low percentage.
      generated: record.generated === 0n ? matched.generated : record.generated,
    };
  });
  const v3Coverage = countRecords(v3WithSource);
  const v2NotRepresentedInV3 = v2.filter((record) => (
    !pairedV2Indexes.has(record.sourceIndex)
    // A legacy V2 row whose original V1 purchase is explicitly registered in
    // V3 is only a bridge copy. V3 is the one authoritative visible record.
    && !(record.legacyV1Mirror && v1AlreadyInV3.some((v1Record) => (
      v1Record.timestamp === record.timestamp
      && v1Record.amount === record.amount
    )))
  ));
  const visibleV2 = removeCovered(v2NotRepresentedInV3, v3Coverage);
  // All V2 rows (including a V2 row already represented by V3) cover their
  // matching V1 legacy copy. Any V3 row left after V2 matching is V1-only.
  const v1NotRegisteredInV3 = v1.filter((record) => !record.migratedToV3);
  const v1AfterV2 = removeCovered(v1NotRegisteredInV3, countRecords(visibleV2));
  const visibleV1 = removeCovered(v1AfterV2, v3Coverage);
  const records = [...visibleV1, ...visibleV2, ...v3WithSource]
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
  return {
    records, failures,
    sourceTotals: {
      v1Claimable: sumBigInt(visibleV1, "claimable"),
      v2AggregateLimit: v2Data.aggregateLimit,
      v2AggregateUsed: v2Data.aggregateUsed,
      v3AggregateLimit: v3Data.aggregateLimit,
      v3AggregateUsed: v3Data.aggregateUsed,
      v2PendingSelfRoi: v2Data.pendingSelfRoi,
      v3PendingSelfRoi: v3Data.pendingSelfRoi,
      v2RoiDay: v2Data.roiDay,
      v3RoiDay: v3Data.roiDay,
    },
  };
};
