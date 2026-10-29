import { TableCell } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2FlushLedgerABI from "../../../blockchain/v2FlushLedgerABI";
import { LegacyV2FlushLedgerAddress, V2FlushLedgerAddress } from "../../../blockchain/address";
import { BSC_MAINNET } from "../../../blockchain/bscMainnetConfig";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import "../styles/style.css";

const labels = ["Direct", "Self ROI", "Level ROI", "Power", "Reward"];
const READ_BATCH_SIZE = 10;

const formatAmount = (value) => {
  try { return Number(ethers.formatEther(value ?? 0n)).toFixed(4); } catch { return "0.0000"; }
};
const formatTime = (value) => {
  const time = Number(value ?? 0n);
  return time ? new Date(time * 1000).toLocaleString() : "-";
};

const createBackupReadProvider = () => {
  const request = new ethers.FetchRequest(BSC_MAINNET.rpcUrls[1]);
  request.timeout = 20_000;
  return new ethers.JsonRpcProvider(request, BSC_MAINNET.chainId, { staticNetwork: true });
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

export const FlushIncome = () => {
  const [summary, setSummary] = useState(Array(5).fill("0.0000"));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");
      const user = await getReadWalletAddress();
      if (!user || !ethers.isAddress(user)) throw new Error("Please connect your wallet.");

      const readFlushLedger = async (ledgerAddress, provider) => {
        const flushLedger = new ethers.Contract(ledgerAddress, V2FlushLedgerABI, provider);
        const [totals, historyLength] = await Promise.all([
          Promise.all(labels.map((_, type) => flushLedger.totalFlushedIncome(user, type))),
          flushLedger.getFlushHistoryLength(user),
        ]);
        const records = await readInBatches(Number(historyLength), async (index) => ({
          record: await flushLedger.getFlushHistoryAt(user, index),
          recordIndex: index,
        }));
        return { totals, records };
      };

      const readWithFallback = async (ledgerAddress) => {
        try { return await readFlushLedger(ledgerAddress, createBscReadProvider()); }
        catch { return readFlushLedger(ledgerAddress, createBackupReadProvider()); }
      };
      const [v2Result, v3Result] = await Promise.allSettled([
        readWithFallback(LegacyV2FlushLedgerAddress),
        readWithFallback(V2FlushLedgerAddress),
      ]);
      const v2Snapshot = v2Result.status === "fulfilled" ? v2Result.value : { totals: [0n, 0n, 0n, 0n, 0n], records: [] };
      const v3Snapshot = v3Result.status === "fulfilled" ? v3Result.value : { totals: [0n, 0n, 0n, 0n, 0n], records: [] };
      setSummary(v2Snapshot.totals.map((total, index) => formatAmount(total + v3Snapshot.totals[index])));
      const toRows = (snapshot) => snapshot.records.map(({ record, recordIndex }) => {
        const typeOrder = Number(record.incomeType);
        const timestamp = Number(record.timestamp ?? 0n);
        return {
          type: labels[typeOrder] || "Unknown",
          typeOrder,
          amount: formatAmount(record.amount),
          timestamp,
          time: formatTime(timestamp),
          recordIndex,
        };
      });

      const combinedRows = [...toRows(v2Snapshot), ...toRows(v3Snapshot)]
        .sort((a, b) => {
          if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
          if (a.recordIndex !== b.recordIndex) return b.recordIndex - a.recordIndex;
          return a.typeOrder - b.typeOrder;
        })
        .map((row, index) => ({ ...row, sno: index + 1 }));

      setRows(combinedRows);
      if (v2Result.status === "rejected" || v3Result.status === "rejected") {
        setMessage("Some Flush history data could not be loaded. Please refresh.");
      }
    } catch (error) {
      setMessage(error?.shortMessage || error?.message || "Could not refresh Flush history. Please try Refresh again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "type", label: "Income Type", sortable: true },
    { id: "amount", label: "Flushed Amount", sortable: true },
    { id: "timestamp", label: "Flush Time", sortable: true },
  ];

  return (
    <div className="page-container">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="mb-0">Flush Income History</h1>
        <button className="btn btn-outline-primary" onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
      </div>
      <div className="withdrawal-grid" style={{ marginBottom: "14px" }}>
        {labels.map((label, index) => (
          <React.Fragment key={label}>
            <div className="withdrawal-card"><p className="withdrawal-card-title">{label} Flushed</p><h4 className="withdrawal-card-value">{summary[index]}</h4></div>
          </React.Fragment>
        ))}
      </div>
      {message ? <p className="text-danger">{message}</p> : null}
      <CustomTable columns={columns} rows={rows} renderRow={(row) => (
        <>
          <TableCell align="center">{row.sno}</TableCell>
          <TableCell align="center">{row.type}</TableCell>
          <TableCell align="center">{row.amount}</TableCell>
          <TableCell align="center">{row.time}</TableCell>
        </>
      )} />
    </div>
  );
};

export default FlushIncome;
