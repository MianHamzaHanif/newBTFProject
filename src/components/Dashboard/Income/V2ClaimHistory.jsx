import { TableCell } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2IncomeLedgerABI from "../../../blockchain/v2IncomeLedgerABI";
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
  const [v2Total, setV2Total] = useState("0.0000");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    const incomeType = eventIncomeType[eventName];
    if (incomeType === undefined) {
      setRows([]);
      setMessage("Choose a specific income type to view its V2 claim history.");
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

      const v2Ledger = new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, createBscReadProvider());

      const v2LengthRaw = await v2Ledger.getUserIncomeHistoryLengthByType(wallet, incomeType);

      const v2Records = await readInBatches(Number(v2LengthRaw), (index) =>
        v2Ledger.getUserIncomeHistoryAtByType(wallet, incomeType, index)
      );

      const v2Sum = v2Records.reduce((total, record) => total + BigInt(record.amount ?? record[1] ?? 0n), 0n);
      setV2Total(formatAmount(v2Sum));

      const combinedRows = v2Records.map((record) => ({
          network: "V2 (New)",
          incomeType: incomeName[incomeType],
          level: Number(record.level ?? record[0]) || "-",
          amount: formatAmount(record.amount ?? record[1]),
          timestamp: formatTime(record.timestamp ?? record[2])
        })).map((record, index) => ({ ...record, sno: index + 1 }));

      setRows(combinedRows);
      if (combinedRows.length === 0) setMessage("No V2 claim history found.");
    } catch (error) {
      setRows([]);
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
          <p className="withdrawal-card-title">V2 Claimed</p>
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
