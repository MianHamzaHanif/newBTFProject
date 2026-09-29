import { TableCell } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import ReferralNetworkABI from "../../../blockchain/referralNetworkABI.json";
import V2IncomeLedgerABI from "../../../blockchain/v2IncomeLedgerABI";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import { V2LedgerAddress } from "../../../blockchain/address";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import "../styles/style.css";

const eventIncomeType = {
  DirectIncomeClaimed: 0,
  SelfRoiClaimed: 1,
  LevelRoiClaimed: 2,
  PowerIncomeClaimed: 3,
  RewardIncomeClaimed: 4
};

const incomeName = ["Direct Income", "Self ROI", "Level ROI", "Power Income", "Reward Income"];
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const READ_BATCH_SIZE = 10;

const formatAmount = (amount) => {
  try {
    return Number(ethers.formatEther(amount || 0n)).toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    });
  } catch {
    return "0.0000";
  }
};

const formatAddress = (address) => {
  if (!address || address.toLowerCase() === ZERO_ADDRESS) return "-";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatTime = (timestamp) =>
  Number(timestamp) ? new Date(Number(timestamp) * 1000).toLocaleString() : "-";

async function readInBatches(length, readRecord) {
  const records = [];
  for (let end = length; end > 0; end -= READ_BATCH_SIZE) {
    const start = Math.max(0, end - READ_BATCH_SIZE);
    const indexes = Array.from({ length: end - start }, (_, offset) => end - 1 - offset);
    const batch = await Promise.all(indexes.map(readRecord));
    records.push(...batch);
  }
  return records;
}

export default function V2ClaimHistory({ eventName = "", heading = "Income History" }) {
  const [rows, setRows] = useState([]);
  const [v1Total, setV1Total] = useState("0.0000");
  const [v2Total, setV2Total] = useState("0.0000");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    const incomeType = eventIncomeType[eventName];
    if (incomeType === undefined) {
      setRows([]);
      setMessage("Choose a specific income type to view its V1 and V2 history.");
      return;
    }

    const wallet = await getReadWalletAddress();
    if (!ethers.isAddress(wallet)) {
      setRows([]);
      setMessage("Please connect your wallet.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const v1Referral = new ethers.Contract(
        V1_MAINNET.referralNetwork,
        ReferralNetworkABI,
        new ethers.JsonRpcProvider(V1_MAINNET.rpcUrl)
      );
      const v2Ledger = new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, createBscReadProvider());

      const [v1LengthRaw, v2LengthRaw] = await Promise.all([
        v1Referral.getUserIncomeWithdrawRecordsLengthByType(wallet, incomeType),
        v2Ledger.getUserIncomeHistoryLengthByType(wallet, incomeType)
      ]);

      const [v1Records, v2Records] = await Promise.all([
        readInBatches(Number(v1LengthRaw), (index) =>
          v1Referral.getUserIncomeWithdrawRecordAtByType(wallet, incomeType, index)
        ),
        readInBatches(Number(v2LengthRaw), (index) =>
          v2Ledger.getUserIncomeHistoryAtByType(wallet, incomeType, index)
        )
      ]);

      const v1Sum = v1Records.reduce((total, record) => total + BigInt(record.amount ?? record[1] ?? 0n), 0n);
      const v2Sum = v2Records.reduce((total, record) => total + BigInt(record.amount ?? record[1] ?? 0n), 0n);
      setV1Total(formatAmount(v1Sum));
      setV2Total(formatAmount(v2Sum));

      // V1 history intentionally appears first. It represents already-paid legacy income;
      // V2 rows are new ledger claims and are not duplicates to remove.
      const combinedRows = [
        ...v1Records.map((record) => ({
          network: "V1 (Legacy)",
          incomeType: incomeName[incomeType],
          level: "-",
          source: formatAddress(record.source ?? record[2]),
          amount: formatAmount(record.amount ?? record[1]),
          timestamp: formatTime(record.timestamp ?? record[3])
        })),
        ...v2Records.map((record) => ({
          network: "V2 (New)",
          incomeType: incomeName[incomeType],
          level: Number(record.level ?? record[0]) || "-",
          source: "V2 Income Ledger",
          amount: formatAmount(record.amount ?? record[1]),
          timestamp: formatTime(record.timestamp ?? record[2])
        }))
      ].map((record, index) => ({ ...record, sno: index + 1 }));

      setRows(combinedRows);
      if (combinedRows.length === 0) setMessage("No V1 or V2 claim history found.");
    } catch (error) {
      setRows([]);
      setV1Total("0.0000");
      setV2Total("0.0000");
      setMessage(error?.shortMessage || "Unable to load income history.");
    } finally {
      setLoading(false);
    }
  }, [eventName]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const columns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "incomeType", label: "Income Type", sortable: true },
    ...(["DirectIncomeClaimed", "SelfRoiClaimed", "LevelRoiClaimed"].includes(eventName) ? [] : [
      { id: "level", label: "Level", sortable: true },
    ]),
    { id: "amount", label: "Claimed USDT", sortable: true },
    { id: "timestamp", label: "Claim Time", sortable: true }
  ];

  return (
    <div className="page-container">
      <h1>{heading}</h1>
      <div className="withdrawal-grid mb-4">
        <div className="withdrawal-card">
          <p className="withdrawal-card-title">V1 Legacy Claimed</p>
          <h4 className="withdrawal-card-value">{v1Total} USDT</h4>
        </div>
        <div className="withdrawal-card">
          <p className="withdrawal-card-title">V2 New Claimed</p>
          <h4 className="withdrawal-card-value">{v2Total} USDT</h4>
        </div>
      </div>
      <div className="table-wrapper">
        <div className="table-card">
          <button className="btn btn-primary mb-3" onClick={loadHistory} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
          {message && <p className="team-loading">{message}</p>}
          <CustomTable
            columns={columns}
            rows={rows}
            renderRow={(row) => (
              <>
                <TableCell align="center">{row.sno}</TableCell>
                <TableCell align="center">{row.incomeType}</TableCell>
                {!['DirectIncomeClaimed', 'SelfRoiClaimed', 'LevelRoiClaimed'].includes(eventName) && <TableCell align="center">{row.level}</TableCell>}
                <TableCell align="center">{row.amount}</TableCell>
                <TableCell align="center" className="team-time-cell">{row.timestamp}</TableCell>
              </>
            )}
          />
        </div>
      </div>
    </div>
  );
}
