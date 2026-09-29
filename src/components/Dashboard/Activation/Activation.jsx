import { TableCell } from "@mui/material";
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import PackageManagerABI from "../../../blockchain/packageMangerABI.json";
import V2PackageManagerABI from "../../../blockchain/v2PackageManagerABI";
import { PackageManagerAddress, V2VerifiedLegacyImporterAddress } from "../../../blockchain/address";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import "../styles/style.css";

const LEGACY_IMPORT_EVENT = new ethers.Interface([
  "event LegacyPackageSnapshotImported(address indexed user,uint256 indexed sourceIndex,uint256 amount,uint256 usedIncome)",
]);

const formatUsdt = (value) => {
  try { return Number(ethers.formatEther(value ?? 0n)).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }); }
  catch { return "0.0000"; }
};
const formatTime = (value) => Number(value ?? 0n) ? new Date(Number(value) * 1000).toLocaleString() : "-";
const sum = (items, value) => items.reduce((total, item) => total + BigInt(value(item) ?? 0n), 0n);
const percent = (numerator, denominator) => {
  const top = BigInt(numerator ?? 0n), bottom = BigInt(denominator ?? 0n);
  return bottom <= 0n ? "0.00" : (Number((top * 10000n) / bottom) / 100).toFixed(2);
};
const incomeLimitForPackage = (amount) => {
  const value = BigInt(amount ?? 0n);
  if (value === ethers.parseEther("25")) return ethers.parseEther("75");
  if (value === ethers.parseEther("100")) return ethers.parseEther("500");
  if (value === ethers.parseEther("500")) return ethers.parseEther("3500");
  if (value === ethers.parseEther("1000")) return ethers.parseEther("10000");
  return 0n;
};
const createV1ReadProvider = () => {
  const request = new ethers.FetchRequest(V1_MAINNET.rpcUrl);
  request.timeout = 30_000;
  return new ethers.JsonRpcProvider(request, V1_MAINNET.chainId, { staticNetwork: true, batchMaxCount: 1, batchStallTime: 0 });
};

// This event stores the real V1 sourceIndex used by each V2 package import.
// It is the authoritative de-duplication key, unlike amount/date guesses.
const readImportedV1Indexes = async (provider, user) => {
  if (!ethers.isAddress(V2VerifiedLegacyImporterAddress)) return null;
  try {
    const event = LEGACY_IMPORT_EVENT.getEvent("LegacyPackageSnapshotImported");
    const logs = await provider.getLogs({
      address: V2VerifiedLegacyImporterAddress,
      topics: [event.topicHash, ethers.zeroPadValue(user, 32)], fromBlock: 0, toBlock: "latest",
    });
    return new Set(logs.map((log) => Number(LEGACY_IMPORT_EVENT.parseLog(log).args.sourceIndex)));
  } catch { return null; }
};

export const Activation = () => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadActivation = async () => {
      try {
        setIsLoading(true); setMessage("");
        const user = await getReadWalletAddress();
        if (!ethers.isAddress(user)) throw new Error("Please connect your wallet.");

        const v1Manager = new ethers.Contract(V1_MAINNET.packageManager, PackageManagerABI, createV1ReadProvider());
        const provider = createBscReadProvider();
        const v2Manager = new ethers.Contract(PackageManagerAddress, V2PackageManagerABI, provider);
        const [v1Result, v2Result, importedResult] = await Promise.allSettled([
          (async () => {
            const [lengthRaw, oneDay] = await Promise.all([v1Manager.getStakeHistoryLength(user), v1Manager.oneDay()]);
            const records = await Promise.all(Array.from({ length: Number(lengthRaw) }, async (_, index) => {
              const [stake, income, roi] = await Promise.all([
                v1Manager.userStakeHistory(user, index), v1Manager.getStakeIncomeStatus(user, index), v1Manager.getStakeRoiInfo(user, index),
              ]);
              const amount = BigInt(stake?.packageValue ?? stake?.[0] ?? 0n);
              const maximum = BigInt(roi?.maxRoi ?? roi?.[1] ?? 0n);
              const generated = BigInt(roi?.totalAccrued ?? roi?.[2] ?? 0n);
              const completed = Boolean(income?.completed ?? income?.[3]);
              return {
                v1Index: index, amount, timestamp: BigInt(stake?.timestamp ?? stake?.[7] ?? 0n), maximum, generated,
                claimable: BigInt(roi?.claimable ?? roi?.[4] ?? 0n), incomeLimit: BigInt(income?.incomeLimit ?? income?.[0] ?? 0n),
                // The V1 income-cap completion flag is the real package
                // state. Self ROI may be below its own cap even though this
                // package has already completed its overall income limit.
                active: !completed,
              };
            }));
            return { records, oneDay: BigInt(oneDay ?? 86400n) };
          })(),
          (async () => {
            const [lengthRaw, pendingRoi, roiDay] = await Promise.all([
              v2Manager.getPackageHistoryLength(user), v2Manager.pendingSelfRoi(user), v2Manager.ROI_DAY(),
            ]);
            const records = await Promise.all(Array.from({ length: Number(lengthRaw) }, async (_, index) => {
              const record = await v2Manager.getPackageHistoryAt(user, index);
              return {
                v2Index: index, amount: BigInt(record.amount ?? record[0] ?? 0n), timestamp: BigInt(record.purchasedAt ?? record[1] ?? 0n),
                generated: BigInt(record.roiGenerated ?? record[3] ?? 0n), maximum: BigInt(record.roiMaximum ?? record[4] ?? 0n),
                active: Boolean(record.active ?? record[5]),
              };
            }));
            return { records, pendingRoi: BigInt(pendingRoi ?? 0n), roiDay: BigInt(roiDay ?? 0n) };
          })(),
          readImportedV1Indexes(provider, user),
        ]);

        const failures = [];
        const v1 = v1Result.status === "fulfilled" ? v1Result.value : { records: [], oneDay: 0n };
        const v2 = v2Result.status === "fulfilled" ? v2Result.value : { records: [], pendingRoi: 0n, roiDay: 0n };
        if (v1Result.status === "rejected") failures.push("V1 package data could not be loaded");
        if (v2Result.status === "rejected") failures.push("V2 package data could not be loaded");
        const importedIndexes = importedResult.status === "fulfilled" ? importedResult.value : null;

        // Should an RPC block historic logs, retain the former conservative
        // amount/time fallback. Normally importedIndexes is used instead.
        const fallbackMatches = new Map();
        if (!importedIndexes) for (const record of v2.records) {
          const key = `${record.amount}|${record.timestamp}`;
          fallbackMatches.set(key, (fallbackMatches.get(key) || 0) + 1);
        }
        const visibleV1 = v1.records.filter((record) => {
          if (importedIndexes) return !importedIndexes.has(record.v1Index);
          const key = `${record.amount}|${record.timestamp}`, count = fallbackMatches.get(key) || 0;
          if (!count) return true;
          fallbackMatches.set(key, count - 1);
          return false;
        });

        const viewRows = [
          ...visibleV1.map((record) => ({
            ...record, packageAmount: formatUsdt(record.amount), purchasedAt: formatTime(record.timestamp),
            roiMaximum: formatUsdt(record.maximum), status: record.active ? "V1 Active - ROI Running" : "V1 Inactive - Package Limit Completed", roiStatus: record.active ? "Yes" : "No",
          })),
          ...v2.records.map((record) => {
            const roiActive = record.active && record.generated < record.maximum;
            return {
              ...record, packageAmount: formatUsdt(record.amount), purchasedAt: formatTime(record.timestamp), roiMaximum: formatUsdt(record.maximum),
              status: record.active ? (roiActive ? "V2 Active - ROI Running" : "V2 Active - Self ROI Complete") : "V2 Inactive", roiStatus: roiActive ? "Yes" : "No",
            };
          }),
        ].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

        const activeV1 = visibleV1.filter((record) => record.active), activeV2 = v2.records.filter((record) => record.active);
        const allMaximum = sum(visibleV1, (record) => record.maximum) + sum(v2.records, (record) => record.maximum);
        const allGenerated = sum(visibleV1, (record) => record.generated) + sum(v2.records, (record) => record.generated);
        const activePrincipal = sum(activeV1, (record) => record.amount) + sum(activeV2, (record) => record.amount);
        const activeMaximum = sum(activeV1, (record) => record.maximum) + sum(activeV2, (record) => record.maximum);
        const allLimit = sum(visibleV1, (record) => record.incomeLimit) + sum(v2.records, (record) => incomeLimitForPackage(record.amount));
        const activeLimit = sum(activeV1, (record) => record.incomeLimit) + sum(activeV2, (record) => incomeLimitForPackage(record.amount));
        if (cancelled) return;
        setRows(viewRows.map((record, index) => ({ ...record, sno: index + 1 })));
        setSummary({
          totalRoiPackageAmount: formatUsdt(sum(visibleV1, (record) => record.amount) + sum(v2.records, (record) => record.amount)),
          activePackagesAmount: formatUsdt(activePrincipal), pendingRoi: formatUsdt(sum(activeV1, (record) => record.claimable) + v2.pendingRoi),
          roiMaximum: formatUsdt(allMaximum), roiProgress: `${percent(allGenerated, activeMaximum)}% / 100.00%`,
          allPackagesIncomeLimit: formatUsdt(allLimit), activePackagesIncomeLimit: formatUsdt(activeLimit),
          roiDay: `V1: ${Number(v1.oneDay) / 60 || 0} min | V2: ${Number(v2.roiDay) / 60 || 0} min`,
        });
        setMessage(failures.length ? `${failures.join(". ")}. Other available package data is shown.` : viewRows.length ? "" : "No V1 or V2 package has been purchased yet.");
      } catch (error) {
        if (!cancelled) { setRows([]); setSummary(null); setMessage(error?.shortMessage || error?.reason || error?.message || "Unable to load activation details."); }
      } finally { if (!cancelled) setIsLoading(false); }
    };
    void loadActivation();
    return () => { cancelled = true; };
  }, []);

  const columns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "packageAmount", label: "Package Amount", sortable: true }, { id: "purchasedAt", label: "Purchased At", sortable: true },
    { id: "roiMaximum", label: "Self ROI 3x Limit", sortable: true }, { id: "status", label: "Package Status", sortable: true },
    { id: "roiStatus", label: "Self ROI Active", sortable: true },
  ];

  return <div className="page-container"><h1>Activation Package</h1>
    {summary && <div className="withdrawal-grid mb-4">
      <div className="withdrawal-card"><p className="withdrawal-card-title">Total Amount Receiving Self ROI</p><h4 className="withdrawal-card-value">{summary.totalRoiPackageAmount}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Active Packages Total</p><h4 className="withdrawal-card-value">{summary.activePackagesAmount}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Self ROI Claimable</p><h4 className="withdrawal-card-value">{summary.pendingRoi}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Self ROI 3x Limit</p><h4 className="withdrawal-card-value">{summary.roiMaximum}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Self ROI Progress / Target</p><h4 className="withdrawal-card-value">{summary.roiProgress}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Overall Income Claim Limit (All Packages)</p><h4 className="withdrawal-card-value">{summary.allPackagesIncomeLimit}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Active Income Claim Limit</p><h4 className="withdrawal-card-value">{summary.activePackagesIncomeLimit}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">ROI Day</p><h4 className="withdrawal-card-value">{summary.roiDay}</h4></div>
    </div>}
    <div className="table-wrapper"><div className="table-card">
      {isLoading && <p className="team-loading">Loading  package details...</p>}
      {!isLoading && message && <p className="team-loading">{message}</p>}
      <CustomTable columns={columns} rows={rows} renderRow={(row) => <>
        <TableCell align="center">{row.sno}</TableCell><TableCell align="center">{row.packageAmount}</TableCell>
        <TableCell align="center">{row.purchasedAt}</TableCell><TableCell align="center">{row.roiMaximum}</TableCell><TableCell align="center">{row.status}</TableCell><TableCell align="center">{row.roiStatus}</TableCell>
      </>} />
    </div></div>
  </div>;
};

export default Activation;
