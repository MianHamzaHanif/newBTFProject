import { TableCell } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2IncomeLedgerABI from "../../../blockchain/v2IncomeLedgerABI";
import V2PackageManagerABI from "../../../blockchain/v2PackageManagerABI";
import {
  IncomeReadyLensAddress,
  LegacyV2LedgerAddress,
  LegacyV2PackageManagerAddress,
  PackageManagerAddress,
  V2LedgerAddress,
} from "../../../blockchain/address";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import "../styles/style.css";

const eventIncomeType = {
  DirectIncomeClaimed: 0,
  SelfRoiClaimed: 1,
  LevelRoiClaimed: 2,
  PowerIncomeClaimed: 3,
  RewardIncomeClaimed: 4,
};
const incomeName = ["Direct Income", "Self ROI", "Level ROI", "Power Income", "Reward Income"];
const READ_BATCH_SIZE = 10;
const V1_INCOME_HISTORY_ABI = [
  "function getUserIncomeWithdrawRecordsLengthByType(address user,uint8 incomeType) view returns(uint256)",
  "function getUserIncomeWithdrawRecordAtByType(address user,uint8 incomeType,uint256 index) view returns(address userAddress,uint256 amount,address source,uint256 timestamp)",
];


const formatAmount = (amount) => {
  try {
    return Number(ethers.formatEther(amount ?? 0n)).toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  } catch {
    return "0.0000";
  }
};
const formatTime = (timestamp) =>
  Number(timestamp) ? new Date(Number(timestamp) * 1000).toLocaleString() : "-";

async function readInBatches(length, readRecord) {
  const records = [];
  for (let end = length; end > 0; end -= READ_BATCH_SIZE) {
    const start = Math.max(0, end - READ_BATCH_SIZE);
    const indexes = Array.from({ length: end - start }, (_, offset) => end - 1 - offset);
    records.push(...await Promise.all(indexes.map(readRecord)));
  }
  return records;
}

const createV1ReadProvider = () => {
  const request = new ethers.FetchRequest(V1_MAINNET.rpcUrl);
  request.timeout = 30_000;
  return new ethers.JsonRpcProvider(request, V1_MAINNET.chainId, {
    staticNetwork: true, batchMaxCount: 1, batchStallTime: 0,
  });
};

// V1 recorded claims in ReferralNetwork rather than in an IncomeLedger. Keep
// that historical source separate, then merge it with the two ledger eras.
async function readV1Income(wallet, incomeType) {
  if (incomeType === undefined) return { ready: 0n, claimed: 0n, records: [] };
  const registry = new ethers.Contract(V1_MAINNET.referralNetwork, V1_INCOME_HISTORY_ABI, createV1ReadProvider());
  const length = Number(await registry.getUserIncomeWithdrawRecordsLengthByType(wallet, incomeType));
  const records = await readInBatches(length, async (index) => {
    const record = await registry.getUserIncomeWithdrawRecordAtByType(wallet, incomeType, index);
    return {
      recordSource: "v1",
      incomeType: incomeName[incomeType] || "Unknown",
      amount: BigInt(record.amount ?? record[1] ?? 0n),
      timestamp: BigInt(record.timestamp ?? record[3] ?? 0n),
    };
  });
  return { ready: 0n, claimed: records.reduce((total, record) => total + record.amount, 0n), records };
}

async function readLedgerIncome(wallet, incomeType, { ledgerAddress, managerAddress, lensAddress = "", recordSource }) {
  const provider = createBscReadProvider();
  const ledger = new ethers.Contract(ledgerAddress, V2IncomeLedgerABI, provider);
  const isFiltered = incomeType !== undefined;
  const lengthRaw = isFiltered
    ? await ledger.getUserIncomeHistoryLengthByType(wallet, incomeType)
    : await ledger.getUserIncomeHistoryLength(wallet);
  const records = await readInBatches(Number(lengthRaw), async (index) => {
    const record = isFiltered
      ? await ledger.getUserIncomeHistoryAtByType(wallet, incomeType, index)
      : await ledger.getUserIncomeHistoryAt(wallet, index);
    return {
      recordSource,
      incomeType: isFiltered
        ? incomeName[incomeType]
        : incomeName[Number(record.incomeType ?? record[0])] || "Unknown",
      amount: BigInt(record.amount ?? record[isFiltered ? 1 : 2] ?? 0n),
      timestamp: BigInt(record.timestamp ?? record[isFiltered ? 2 : 3] ?? 0n),
    };
  });
  let ready = 0n;
  if (isFiltered) {
    // Ready amount is informational only. A missing/older lens must never
    // hide an otherwise valid V2 claim-history table.
    try {
      const manager = new ethers.Contract(managerAddress, V2PackageManagerABI, provider);
      const resolvedLens = lensAddress || await manager.incomeReadyLens();
      const lens = new ethers.Contract(resolvedLens, V2PackageManagerABI, provider);
      ready = BigInt(await lens.getIncomeReady(wallet, incomeType));
    } catch {
      ready = 0n;
    }
  }
  return { ready, claimed: records.reduce((total, record) => total + record.amount, 0n), records };
}

// A Level ROI claim can contain separate credits for several downline levels
// in one transaction/block timestamp. The user sees it as one Level ROI
// claim, so present a single total row while retaining all other income rows.
function groupSameTimeLevelRoi(records) {
  const grouped = new Map();
  for (const record of records) {
    if (record.incomeType !== "Level ROI") {
      grouped.set(`row:${grouped.size}`, record);
      continue;
    }
    const key = `level-roi:${record.recordSource || "v1"}:${record.timestamp}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.amount += record.amount;
    } else {
      grouped.set(key, { ...record });
    }
  }
  return [...grouped.values()];
}

export default function V2ClaimHistory({ eventName = "", heading = "Claim History" }) {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ ready: 0n, claimed: 0n });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    const incomeType = eventIncomeType[eventName];
    const wallet = await getReadWalletAddress();
    if (!ethers.isAddress(wallet)) {
      setRows([]);
      setMessage("Please connect your wallet.");
      return;
    }
    try {
      setLoading(true);
      setMessage("");
      const [v1Result, v2Result, v3Result] = await Promise.allSettled([
        readV1Income(wallet, incomeType),
        readLedgerIncome(wallet, incomeType, {
          ledgerAddress: LegacyV2LedgerAddress,
          managerAddress: LegacyV2PackageManagerAddress,
          recordSource: "v2",
        }),
        readLedgerIncome(wallet, incomeType, {
          ledgerAddress: V2LedgerAddress,
          managerAddress: PackageManagerAddress,
          lensAddress: IncomeReadyLensAddress,
          recordSource: "v3",
        }),
      ]);
      const v1 = v1Result.status === "fulfilled" ? v1Result.value : { ready: 0n, claimed: 0n, records: [] };
      const v2 = v2Result.status === "fulfilled" ? v2Result.value : { ready: 0n, claimed: 0n, records: [] };
      const v3 = v3Result.status === "fulfilled" ? v3Result.value : { ready: 0n, claimed: 0n, records: [] };
      const combinedRows = groupSameTimeLevelRoi([...v1.records, ...v2.records, ...v3.records])
        // One unified history: newest claim at the top, regardless of its
        // V1/V2/V3 origin; the UI deliberately does not expose that source.
        .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
        .map((record, index) => ({
          ...record,
          sno: index + 1,
          amountDisplay: formatAmount(record.amount),
          timestampDisplay: formatTime(record.timestamp),
        }));
      setRows(combinedRows);
      setTotals({ ready: v1.ready + v2.ready + v3.ready, claimed: v1.claimed + v2.claimed + v3.claimed });
      const failures = [];
      if (v1Result.status === "rejected") failures.push("V1 income history could not be loaded");
      if (v2Result.status === "rejected") failures.push("V2 income history could not be loaded");
      if (v3Result.status === "rejected") failures.push("V3 income history could not be loaded");
      setMessage(failures.length ? `${failures.join(". ")}.` : combinedRows.length ? "" : "No claim history found.");
    } catch (error) {
      setRows([]);
      setTotals({ ready: 0n, claimed: 0n });
      setMessage(error?.shortMessage || error?.reason || error?.message || "Unable to load income history.");
    } finally {
      setLoading(false);
    }
  }, [eventName]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const hasIncomeType = eventIncomeType[eventName] !== undefined;
  const columns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "incomeType", label: "Income Type", sortable: true },
    { id: "amountDisplay", label: "Claimed Amount", sortable: true },
    { id: "timestampDisplay", label: "Claim Time", sortable: true },
  ];

  return <div className="page-container">
    <h1>{heading}</h1>
    {hasIncomeType && <div className="withdrawal-grid mb-4">
      <div className="withdrawal-card"><p className="withdrawal-card-title">Ready Income</p><h4 className="withdrawal-card-value">{formatAmount(totals.ready)}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Total Claimed</p><h4 className="withdrawal-card-value">{formatAmount(totals.claimed)}</h4></div>
    </div>}
    <div className="table-wrapper"><div className="table-card">
      <button className="btn btn-primary mb-3" onClick={loadHistory} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
      {message && <p className="team-loading">{message}</p>}
      <CustomTable columns={columns} rows={rows} renderRow={(row) => <>
        <TableCell align="center">{row.sno}</TableCell>
        <TableCell align="center">{row.incomeType}</TableCell>
        <TableCell align="center">{row.amountDisplay}</TableCell>
        <TableCell align="center" className="team-time-cell">{row.timestampDisplay}</TableCell>
      </>} />
    </div></div>
  </div>;
}
