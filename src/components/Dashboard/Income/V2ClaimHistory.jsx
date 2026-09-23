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

export default function V2ClaimHistory({ eventName = "", heading = "V2 Claim History" }) {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!ethers.isAddress(V2LedgerAddress)) {
      setRows([]);
      setMessage("V2 Ledger address is not configured yet.");
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
      const ledger = new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, createBscReadProvider());
      const incomeType = eventIncomeType[eventName];
      const records = [];

      if (incomeType !== undefined) {
        const length = Number(await ledger.getUserIncomeHistoryLengthByType(wallet, incomeType));
        for (let index = length - 1; index >= 0; index -= 1) {
          const record = await ledger.getUserIncomeHistoryAtByType(wallet, incomeType, index);
          records.push({ incomeType, level: record.level, amount: record.amount, timestamp: record.timestamp });
        }
      } else {
        const length = Number(await ledger.getUserIncomeHistoryLength(wallet));
        for (let index = length - 1; index >= 0; index -= 1) {
          const record = await ledger.getUserIncomeHistoryAt(wallet, index);
          records.push({ incomeType: record.incomeType, level: record.level, amount: record.amount, timestamp: record.timestamp });
        }
      }

      setRows(records.map((record, index) => ({
        sno: index + 1,
        incomeType: incomeName[Number(record.incomeType)] || "Unknown",
        amount: formatAmount(record.amount),
        timestamp: Number(record.timestamp)
          ? new Date(Number(record.timestamp) * 1000).toLocaleString()
          : "-"
      })));
      if (records.length === 0) setMessage("No V2 claim history found.");
    } catch (error) {
      setRows([]);
      setMessage(error?.shortMessage || "Unable to load V2 claim history.");
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
    { id: "amount", label: "Claimed USDT", sortable: true },
    { id: "timestamp", label: "Claim Time", sortable: true }
  ];

  return (
    <div className="page-container">
      <h1>{heading}</h1>
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
