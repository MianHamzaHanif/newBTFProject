import { TableCell } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2FlushLedgerABI from "../../../blockchain/v2FlushLedgerABI";
import { V2FlushLedgerAddress } from "../../../blockchain/address";
import { BSC_TESTNET } from "../../../blockchain/bscTestnetConfig";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import "../styles/style.css";

const labels = ["Direct", "Self ROI", "Level ROI", "Power", "Reward"];
const formatAmount = (value) => {
  try { return Number(ethers.formatEther(value ?? 0n)).toFixed(4); } catch { return "0.0000"; }
};
const formatTime = (value) => {
  const time = Number(value ?? 0n);
  return time ? new Date(time * 1000).toLocaleString() : "-";
};

const createBackupReadProvider = () => {
  const request = new ethers.FetchRequest(BSC_TESTNET.rpcUrls[1]);
  request.timeout = 20_000;
  return new ethers.JsonRpcProvider(request, BSC_TESTNET.chainId, { staticNetwork: true });
};

export const FlushIncome = () => {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(["0.0000", "0.0000", "0.0000", "0.0000", "0.0000"]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");
      const user = await getReadWalletAddress();
      if (!user || !ethers.isAddress(user)) throw new Error("Please connect your wallet.");

      // Public Testnet RPCs can intermittently time out. Read the complete
      // snapshot from the primary provider, then retry once on backup RPC.
      const readSnapshot = async (provider) => {
        const flushLedger = new ethers.Contract(V2FlushLedgerAddress, V2FlushLedgerABI, provider);
        const [totals, historyLength] = await Promise.all([
          Promise.all(labels.map((_, type) => flushLedger.totalFlushedIncome(user, type))),
          flushLedger.getFlushHistoryLength(user),
        ]);
        const length = Number(historyLength);
        const records = await Promise.all(
          Array.from({ length }, (_, position) => flushLedger.getFlushHistoryAt(user, length - position - 1)),
        );
        return { totals, records };
      };

      let snapshot;
      try {
        snapshot = await readSnapshot(createBscReadProvider());
      } catch (error) {
        snapshot = await readSnapshot(createBackupReadProvider());
      }
      const { totals, records } = snapshot;

      setSummary(totals.map(formatAmount));
      setRows(records.map((record, index) => ({
        sno: index + 1,
        type: labels[Number(record.incomeType)] || "Unknown",
        amount: formatAmount(record.amount),
        time: formatTime(record.timestamp),
      })));
    } catch (error) {
      // Preserve a successful snapshot instead of making the UI appear to
      // lose data when a later background/manual RPC refresh times out.
      setMessage(error?.shortMessage || error?.message || "Could not refresh V2 Flush history. Please try Refresh again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "type", label: "Income Type", sortable: true },
    { id: "amount", label: "Flushed Amount", sortable: true },
    { id: "time", label: "Flush Time", sortable: true },
  ];

  return (
    <div className="page-container">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="mb-0">V2 Flush Income</h1>
        <button className="btn btn-outline-primary" onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
      </div>
      <div className="withdrawal-grid" style={{ marginBottom: "14px" }}>
        {labels.map((label, index) => (
          <div className="withdrawal-card" key={label}>
            <p className="withdrawal-card-title">{label} Flushed</p>
            <h4 className="withdrawal-card-value">{summary[index]} USDT</h4>
          </div>
        ))}
      </div>
      {message ? <p className="text-danger">{message}</p> : null}
      <CustomTable columns={columns} rows={rows} renderRow={(row) => (
        <>
          <TableCell align="center">{row.sno}</TableCell>
          <TableCell align="center">{row.type}</TableCell>
          <TableCell align="center">{row.amount} USDT</TableCell>
          <TableCell align="center">{row.time}</TableCell>
        </>
      )} />
    </div>
  );
};

export default FlushIncome;
