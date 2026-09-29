import { TableCell } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import ReferralNetworkABI from "../../../blockchain/referralNetworkABI.json";
import V2FlushLedgerABI from "../../../blockchain/v2FlushLedgerABI";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import { V2FlushLedgerAddress } from "../../../blockchain/address";
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
  const [v1Summary, setV1Summary] = useState(Array(5).fill("0.0000"));
  const [v2Summary, setV2Summary] = useState(Array(5).fill("0.0000"));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");
      const user = await getReadWalletAddress();
      if (!user || !ethers.isAddress(user)) throw new Error("Please connect your wallet.");

      const readV1 = async () => {
        const referral = new ethers.Contract(
          V1_MAINNET.referralNetwork,
          ReferralNetworkABI,
          new ethers.JsonRpcProvider(V1_MAINNET.rpcUrl)
        );
        const length = Number(await referral.getUserWithdrawSummaryRecordsLength(user));
        const records = await readInBatches(length, async (index) => {
          const [summary, flush] = await Promise.all([
            referral.getUserWithdrawSummaryRecordAt(user, index),
            referral.getUserWithdrawSummaryFlushAt(user, index),
          ]);
          return { summary, flush };
        });
        const totals = [0n, 0n, 0n, 0n, 0n];
        const rows = [];
        records.forEach(({ summary, flush }) => {
          for (let type = 0; type < labels.length; type += 1) {
            const amount = BigInt(flush[type] ?? 0n);
            if (amount === 0n) continue;
            totals[type] += amount;
            rows.push({
              source: "V1 (Legacy)",
              type: labels[type],
              level: "-",
              amount: formatAmount(amount),
              time: formatTime(summary.timestamp ?? summary[7]),
            });
          }
        });
        return { totals, rows };
      };

      const readV2 = async (provider) => {
        const flushLedger = new ethers.Contract(V2FlushLedgerAddress, V2FlushLedgerABI, provider);
        const [totals, historyLength] = await Promise.all([
          Promise.all(labels.map((_, type) => flushLedger.totalFlushedIncome(user, type))),
          flushLedger.getFlushHistoryLength(user),
        ]);
        const records = await readInBatches(Number(historyLength), (index) => flushLedger.getFlushHistoryAt(user, index));
        return { totals, records };
      };

      const v1Promise = readV1();
      let v2Snapshot;
      try {
        v2Snapshot = await readV2(createBscReadProvider());
      } catch {
        v2Snapshot = await readV2(createBackupReadProvider());
      }
      const v1Snapshot = await v1Promise;

      setV1Summary(v1Snapshot.totals.map(formatAmount));
      setV2Summary(v2Snapshot.totals.map(formatAmount));
      const v2Rows = v2Snapshot.records.map((record) => ({
        source: "V2 (New)",
        type: labels[Number(record.incomeType)] || "Unknown",
        level: Number(record.level) || "-",
        amount: formatAmount(record.amount),
        time: formatTime(record.timestamp),
      }));
      setRows([...v1Snapshot.rows, ...v2Rows].map((row, index) => ({ ...row, sno: index + 1 })));
    } catch (error) {
      setMessage(error?.shortMessage || error?.message || "Could not refresh Flush history. Please try Refresh again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "source", label: "Source", sortable: true },
    { id: "type", label: "Income Type", sortable: true },
    { id: "level", label: "Level", sortable: true },
    { id: "amount", label: "Flushed Amount", sortable: true },
    { id: "time", label: "Flush Time", sortable: true },
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
            <div className="withdrawal-card"><p className="withdrawal-card-title">V1 {label} Flushed</p><h4 className="withdrawal-card-value">{v1Summary[index]} USDT</h4></div>
            <div className="withdrawal-card"><p className="withdrawal-card-title">V2 {label} Flushed</p><h4 className="withdrawal-card-value">{v2Summary[index]} USDT</h4></div>
          </React.Fragment>
        ))}
      </div>
      {message ? <p className="text-danger">{message}</p> : null}
      <CustomTable columns={columns} rows={rows} renderRow={(row) => (
        <>
          <TableCell align="center">{row.sno}</TableCell>
          <TableCell align="center">{row.source}</TableCell>
          <TableCell align="center">{row.type}</TableCell>
          <TableCell align="center">{row.level}</TableCell>
          <TableCell align="center">{row.amount} USDT</TableCell>
          <TableCell align="center">{row.time}</TableCell>
        </>
      )} />
    </div>
  );
};

export default FlushIncome;
