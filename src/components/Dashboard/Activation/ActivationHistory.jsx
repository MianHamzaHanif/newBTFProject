import { TableCell } from "@mui/material";
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2PackageManagerABI from "../../../blockchain/v2PackageManagerABI";
import { PackageManagerAddress } from "../../../blockchain/address";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";

const V1_PACKAGE_HISTORY_ABI = [
  "function getStakeHistoryLength(address user) view returns(uint256)",
  "function userStakeHistory(address user,uint256 index) view returns(uint256 packageValue,uint256 usdtAmount,uint256 tokenAmount,uint256 burnAmount,uint256 ownerLockAmount,uint256 userLockAmount,uint256 roiClaimed,uint256 timestamp)",
  "function getStakeIncomeStatus(address user,uint256 index) view returns(uint256 incomeLimit,uint256 usedIncome,uint256 remainingIncome,bool completed)",
];

const formatUsdt = (value) => {
  try {
    return Number(ethers.formatEther(value ?? 0n)).toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  } catch { return "0.0000"; }
};

const formatTime = (value) => {
  const timestamp = Number(value ?? 0n);
  return timestamp ? new Date(timestamp * 1000).toLocaleString() : "-";
};

const readInBatches = async (count, reader, batchSize = 10) => {
  const output = [];
  for (let start = 0; start < count; start += batchSize) {
    const indexes = Array.from({ length: Math.min(batchSize, count - start) }, (_, offset) => start + offset);
    output.push(...await Promise.all(indexes.map(reader)));
  }
  return output;
};

const createV1ReadProvider = () => {
  const request = new ethers.FetchRequest(V1_MAINNET.rpcUrl);
  request.timeout = 30_000;
  return new ethers.JsonRpcProvider(request, V1_MAINNET.chainId, {
    staticNetwork: true,
    batchMaxCount: 1,
    batchStallTime: 0,
  });
};

export const ActivationHistory = () => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadMessage, setLoadMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      try {
        setIsLoading(true);
        setLoadMessage("");
        const walletAddress = await getReadWalletAddress();
        if (!ethers.isAddress(walletAddress)) throw new Error("Please connect your wallet to view activation history.");

        const v1Manager = new ethers.Contract(V1_MAINNET.packageManager, V1_PACKAGE_HISTORY_ABI, createV1ReadProvider());
        const v2Manager = new ethers.Contract(PackageManagerAddress, V2PackageManagerABI, createBscReadProvider());
        const [v1Result, v2Result] = await Promise.allSettled([
          (async () => {
            const length = Number(await v1Manager.getStakeHistoryLength(walletAddress));
            return readInBatches(length, async (index) => {
              const [stake, income] = await Promise.all([
                v1Manager.userStakeHistory(walletAddress, index),
                v1Manager.getStakeIncomeStatus(walletAddress, index),
              ]);
              const amount = stake.packageValue ?? stake[0];
              const limit = income.incomeLimit ?? income[0];
              const used = income.usedIncome ?? income[1];
              return {
                source: "V1", sourceIndex: index, timestamp: stake.timestamp ?? stake[7],
                package: `${formatUsdt(amount)} USDT`, income: `${formatUsdt(used)} / ${formatUsdt(limit)} USDT`,
                usedIncome: used,
                status: (income.completed ?? income[3]) ? "Completed" : "Active",
              };
            });
          })(),
          (async () => {
            const [lengthRaw, aggregateUsed] = await Promise.all([
              v2Manager.getPackageHistoryLength(walletAddress),
              v2Manager.totalIncomeUsed(walletAddress),
            ]);
            const length = Number(lengthRaw);
            return readInBatches(length, async (index) => {
              const record = await v2Manager.getPackageHistoryAt(walletAddress, index);
              const generated = record.roiGenerated ?? record[3];
              const maximum = record.roiMaximum ?? record[4];
              const active = record.active ?? record[5];
              return {
                source: "V2", sourceIndex: index, timestamp: record.purchasedAt ?? record[1],
                package: `${formatUsdt(record.amount ?? record[0])} USDT`, income: `${formatUsdt(generated)} / ${formatUsdt(maximum)} USDT`,
                usedIncome: length === 1 && active ? aggregateUsed : null,
                status: active ? (generated < maximum ? "Active" : "Self ROI Complete") : "Inactive",
              };
            });
          })(),
        ]);

        const failures = [];
        const v1Records = v1Result.status === "fulfilled" ? v1Result.value : [];
        const v2Records = v2Result.status === "fulfilled" ? v2Result.value : [];
        if (v1Result.status === "rejected") failures.push("V1 history could not be loaded");
        if (v2Result.status === "rejected") failures.push("V2 history could not be loaded");

        // A legacy package stored through importLegacyActivePackage preserves
        // the original V1 amount and purchase timestamp in V2 history. Use a
        // multiset (not a simple Set) so that an imported source package is
        // shown once as V2 and its duplicate V1 row is suppressed.
        const importedV1PackageCounts = new Map();
        for (const record of v2Records) {
          const key = `${record.package}|${record.timestamp}`;
          importedV1PackageCounts.set(key, (importedV1PackageCounts.get(key) || 0) + 1);
        }
        const visibleV1Records = v1Records.filter((record) => {
          const key = `${record.package}|${record.timestamp}`;
          const matchingV2Count = importedV1PackageCounts.get(key) || 0;
          if (matchingV2Count === 0) return true;
          importedV1PackageCounts.set(key, matchingV2Count - 1);
          return false;
        });
        const records = [...visibleV1Records, ...v2Records];
        records.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
        const nextRows = records.map((record, index) => ({ ...record, sno: index + 1, purchasedAt: formatTime(record.timestamp) }));

        if (cancelled) return;
        setRows(nextRows);
        setLoadMessage(failures.length ? `${failures.join(". ")}. Other available package history is shown.` : nextRows.length ? "" : "No V1 or V2 activation package found.");
      } catch (error) {
        if (!cancelled) {
          setRows([]);
          setLoadMessage(error?.shortMessage || error?.reason || error?.message || "Failed to load activation history.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadHistory();
    return () => { cancelled = true; };
  }, []);

  const columns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "package", label: "Package", sortable: true },
    { id: "purchasedAt", label: "Purchase Date", sortable: true },
    { id: "usedIncome", label: "Used Limit (USDT)", sortable: true },
    { id: "income", label: "ROI Generated / Limit", sortable: true },
    { id: "status", label: "Status", sortable: true },
  ];

  return <div className="page-container"><h1>Activation History</h1><div className="table-wrapper"><div className="table-card">
    {isLoading && <p className="team-loading">Loading V1 and V2 package history...</p>}
    {!isLoading && loadMessage && <p className="team-loading">{loadMessage}</p>}
    <CustomTable columns={columns} rows={rows} renderRow={(row) => <>
      <TableCell align="center">{row.sno}</TableCell>
      <TableCell align="center">{row.package}</TableCell>
      <TableCell align="center">{row.purchasedAt}</TableCell>
      <TableCell align="center">{row.usedIncome === null ? "-" : `${formatUsdt(row.usedIncome)} USDT`}</TableCell>
      <TableCell align="center">{row.income}</TableCell>
      <TableCell align="center"><span className={`${row.status === "Active" ? "active" : "in-active"} status`}>{row.status}</span></TableCell>
    </>} />
  </div></div></div>;
};

export default ActivationHistory;
