import { TableCell } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2IncomeLedgerABI from "../../../blockchain/v2IncomeLedgerABI";
import V2PackageManagerABI from "../../../blockchain/v2PackageManagerABI";
import { PackageManagerAddress, V2LedgerAddress } from "../../../blockchain/address";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
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

// Existing V1 mainnet read methods only. This UI does not change any V1/V2
// contract state and does not require a DAO proposal.
const V1_MANAGER_ABI = [
  "function pendingDirectIncomeToken(address) view returns(uint256)",
  "function totalDirectIncomeToken(address) view returns(uint256)",
  "function totalSelfRoiIncomeClaimed(address) view returns(uint256)",
  "function totalLevelRoiClaimed(address) view returns(uint256)",
];
const V1_REFERRAL_ABI = [
  "function getSelfRoiClaimableFor(address) view returns(uint256)",
  "function getTotalLevelRoiClaimableFor(address) view returns(uint256)",
  "function getUserIncomeWithdrawRecordsLengthByType(address,uint8) view returns(uint256)",
  "function getUserIncomeWithdrawRecordAtByType(address,uint8,uint256) view returns(address user,uint8 incomeType,uint256 amount,address source,uint256 timestamp)",
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

const createV1ReadProvider = () => {
  const request = new ethers.FetchRequest(V1_MAINNET.rpcUrl);
  request.timeout = 30_000;
  return new ethers.JsonRpcProvider(request, V1_MAINNET.chainId, {
    staticNetwork: true,
    batchMaxCount: 1,
    batchStallTime: 0,
  });
};

async function readInBatches(length, readRecord) {
  const records = [];
  for (let end = length; end > 0; end -= READ_BATCH_SIZE) {
    const start = Math.max(0, end - READ_BATCH_SIZE);
    const indexes = Array.from({ length: end - start }, (_, offset) => end - 1 - offset);
    records.push(...await Promise.all(indexes.map(readRecord)));
  }
  return records;
}

async function readV1Income(wallet, incomeType) {
  const provider = createV1ReadProvider();
  const manager = new ethers.Contract(V1_MAINNET.packageManager, V1_MANAGER_ABI, provider);
  const referral = new ethers.Contract(V1_MAINNET.referralNetwork, V1_REFERRAL_ABI, provider);
  const pendingCall = incomeType === 0
    ? manager.pendingDirectIncomeToken(wallet)
    : incomeType === 1
      ? referral.getSelfRoiClaimableFor(wallet)
      : referral.getTotalLevelRoiClaimableFor(wallet);
  const claimedCall = incomeType === 0
    ? manager.totalDirectIncomeToken(wallet)
    : incomeType === 1
      ? manager.totalSelfRoiIncomeClaimed(wallet)
      : manager.totalLevelRoiClaimed(wallet);
  const [pending, claimed, lengthRaw] = await Promise.all([
    pendingCall,
    claimedCall,
    referral.getUserIncomeWithdrawRecordsLengthByType(wallet, incomeType),
  ]);
  const records = await readInBatches(Number(lengthRaw), async (index) => {
    const record = await referral.getUserIncomeWithdrawRecordAtByType(wallet, incomeType, index);
    return {
      network: "V1 (Legacy)",
      incomeType: incomeName[incomeType],
      amount: BigInt(record.amount ?? record[2] ?? 0n),
      timestamp: BigInt(record.timestamp ?? record[4] ?? 0n),
    };
  });
  return { pending: BigInt(pending), claimed: BigInt(claimed), records };
}

async function readV2Income(wallet, incomeType) {
  const provider = createBscReadProvider();
  const ledger = new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, provider);
  const isFiltered = incomeType !== undefined;
  const lengthRaw = isFiltered
    ? await ledger.getUserIncomeHistoryLengthByType(wallet, incomeType)
    : await ledger.getUserIncomeHistoryLength(wallet);
  const records = await readInBatches(Number(lengthRaw), async (index) => {
    const record = isFiltered
      ? await ledger.getUserIncomeHistoryAtByType(wallet, incomeType, index)
      : await ledger.getUserIncomeHistoryAt(wallet, index);
    return {
      network: "V2 (New)",
      incomeType: isFiltered
        ? incomeName[incomeType]
        : incomeName[Number(record.incomeType ?? record[0])] || "Unknown",
      amount: BigInt(record.amount ?? record[isFiltered ? 1 : 2] ?? 0n),
      timestamp: BigInt(record.timestamp ?? record[isFiltered ? 2 : 3] ?? 0n),
    };
  });
  let ready = 0n;
  if (isFiltered) {
    const manager = new ethers.Contract(PackageManagerAddress, V2PackageManagerABI, provider);
    const lens = new ethers.Contract(await manager.incomeReadyLens(), V2PackageManagerABI, provider);
    ready = BigInt(await lens.getIncomeReady(wallet, incomeType));
  }
  return { ready, claimed: records.reduce((total, record) => total + record.amount, 0n), records };
}

export default function V2ClaimHistory({ eventName = "", heading = "Claim History" }) {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ v1Pending: 0n, v1Claimed: 0n, v2Ready: 0n, v2Claimed: 0n });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    const incomeType = eventIncomeType[eventName];
    const canReadV1 = incomeType !== undefined && incomeType <= 2;
    const wallet = await getReadWalletAddress();
    if (!ethers.isAddress(wallet)) {
      setRows([]);
      setMessage("Please connect your wallet.");
      return;
    }
    try {
      setLoading(true);
      setMessage("");
      const [v1Result, v2Result] = await Promise.allSettled([
        canReadV1 ? readV1Income(wallet, incomeType) : Promise.resolve({ pending: 0n, claimed: 0n, records: [] }),
        readV2Income(wallet, incomeType),
      ]);
      const v1 = v1Result.status === "fulfilled" ? v1Result.value : { pending: 0n, claimed: 0n, records: [] };
      const v2 = v2Result.status === "fulfilled" ? v2Result.value : { ready: 0n, claimed: 0n, records: [] };
      const combinedRows = [...v1.records, ...v2.records]
        .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
        .map((record, index) => ({
          ...record,
          sno: index + 1,
          amountDisplay: formatAmount(record.amount),
          timestampDisplay: formatTime(record.timestamp),
        }));
      setRows(combinedRows);
      setTotals({ v1Pending: v1.pending, v1Claimed: v1.claimed, v2Ready: v2.ready, v2Claimed: v2.claimed });
      const failures = [];
      if (canReadV1 && v1Result.status === "rejected") failures.push("V1 data could not be loaded");
      if (v2Result.status === "rejected") failures.push("V2 data could not be loaded");
      setMessage(failures.length ? `${failures.join(". ")}.` : combinedRows.length ? "" : "No V1 or V2 claim history found.");
    } catch (error) {
      setRows([]);
      setTotals({ v1Pending: 0n, v1Claimed: 0n, v2Ready: 0n, v2Claimed: 0n });
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
    { id: "network", label: "Source", sortable: true },
    { id: "incomeType", label: "Income Type", sortable: true },
    { id: "amountDisplay", label: "Claimed USDT", sortable: true },
    { id: "timestampDisplay", label: "Claim Time", sortable: true },
  ];

  return <div className="page-container">
    <h1>{heading}</h1>
    {hasIncomeType && <div className="withdrawal-grid mb-4">
      <div className="withdrawal-card"><p className="withdrawal-card-title">V1 Pending</p><h4 className="withdrawal-card-value">{formatAmount(totals.v1Pending)} USDT</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">V1 Claimed</p><h4 className="withdrawal-card-value">{formatAmount(totals.v1Claimed)} USDT</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">V2 Ready</p><h4 className="withdrawal-card-value">{formatAmount(totals.v2Ready)} USDT</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">V2 Claimed</p><h4 className="withdrawal-card-value">{formatAmount(totals.v2Claimed)} USDT</h4></div>
    </div>}
    <div className="table-wrapper"><div className="table-card">
      <button className="btn btn-primary mb-3" onClick={loadHistory} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
      {message && <p className="team-loading">{message}</p>}
      <CustomTable columns={columns} rows={rows} renderRow={(row) => <>
        <TableCell align="center">{row.sno}</TableCell>
        <TableCell align="center">{row.network}</TableCell>
        <TableCell align="center">{row.incomeType}</TableCell>
        <TableCell align="center">{row.amountDisplay}</TableCell>
        <TableCell align="center" className="team-time-cell">{row.timestampDisplay}</TableCell>
      </>} />
    </div></div>
  </div>;
}
