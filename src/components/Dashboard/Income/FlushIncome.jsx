import { TableCell } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2FlushLedgerABI from "../../../blockchain/v2FlushLedgerABI";
import { LegacyV2FlushLedgerAddress, V2FlushLedgerAddress } from "../../../blockchain/address";
import { BSC_MAINNET } from "../../../blockchain/bscMainnetConfig";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import { getLegacyV2HistoryCutoffTimestamp, isLegacyV2HistoryVisible } from "../../../blockchain/legacyV2HistoryCutoff";
import "../styles/style.css";

const labels = ["Direct", "Self ROI", "Level ROI", "Power", "Reward"];
const READ_BATCH_SIZE = 10;
const V1_WITHDRAW_FLUSH_ABI = [
  "function getUserWithdrawSummaryRecordsLength(address user) view returns(uint256)",
  "function getUserWithdrawSummaryRecordAt(address user,uint256 index) view returns(address,uint256,uint256,uint256,uint256,uint256,uint256,uint256)",
  "function getUserWithdrawSummaryFlushAt(address user,uint256 index) view returns(uint256 directFlushed,uint256 selfRoiFlushed,uint256 levelRoiFlushed,uint256 powerFlushed,uint256 rewardFlushed)",
];

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
      const readV1FlushSummary = async () => {
        const provider = new ethers.JsonRpcProvider(
          V1_MAINNET.rpcUrl,
          V1_MAINNET.chainId,
          { staticNetwork: true, batchMaxCount: 1 },
        );
        const referral = new ethers.Contract(V1_MAINNET.referralNetwork, V1_WITHDRAW_FLUSH_ABI, provider);
        const length = Number(await referral.getUserWithdrawSummaryRecordsLength(user));
        const records = await readInBatches(length, async (index) => {
          const [summary, flushes] = await Promise.all([
            referral.getUserWithdrawSummaryRecordAt(user, index),
            referral.getUserWithdrawSummaryFlushAt(user, index),
          ]);
          return { summary, flushes, recordIndex: index };
        });
        const totals = records.reduce(
          (running, record) => running.map((total, index) => total + BigInt(record.flushes[index] ?? 0n)),
          [0n, 0n, 0n, 0n, 0n],
        );
        return { totals, records };
      };
      const cutoffTimestamp = await getLegacyV2HistoryCutoffTimestamp();
      const [v1Result, v2Result, v3Result] = await Promise.allSettled([
        readV1FlushSummary(),
        readWithFallback(LegacyV2FlushLedgerAddress),
        readWithFallback(V2FlushLedgerAddress),
      ]);
      const v1Snapshot = v1Result.status === "fulfilled" ? v1Result.value : { totals: [0n, 0n, 0n, 0n, 0n], records: [] };
      const v2Snapshot = v2Result.status === "fulfilled" ? v2Result.value : { totals: [0n, 0n, 0n, 0n, 0n], records: [] };
      const v3Snapshot = v3Result.status === "fulfilled" ? v3Result.value : { totals: [0n, 0n, 0n, 0n, 0n], records: [] };
      // V2 values after the historical cutoff must not appear in either the
      // table or the summary cards. V1 and V3 remain full lifetime totals.
      const visibleV2Totals = v2Snapshot.records.reduce((totals, { record }) => {
        const type = Number(record.incomeType);
        const timestamp = BigInt(record.timestamp ?? 0n);
        const amount = BigInt(record.amount ?? 0n);
        if (
          Number.isInteger(type) && type >= 0 && type < labels.length && amount > 0n
          && isLegacyV2HistoryVisible(timestamp, cutoffTimestamp)
        ) {
          totals[type] += amount;
        }
        return totals;
      }, [0n, 0n, 0n, 0n, 0n]);
      setSummary(v1Snapshot.totals.map((total, index) => formatAmount(total + visibleV2Totals[index] + v3Snapshot.totals[index])));
      const toRows = (snapshot, source) => snapshot.records.flatMap(({ record, recordIndex }) => {
        const typeOrder = Number(record.incomeType);
        const amount = BigInt(record.amount ?? 0n);
        // A zero summary/placeholder is not a Flush-history entry.  This
        // also protects the table from old ledgers that contain empty slots.
        if (!Number.isInteger(typeOrder) || typeOrder < 0 || typeOrder >= labels.length || amount === 0n) return [];
        const timestamp = Number(record.timestamp ?? 0n);
        return [{
          type: labels[typeOrder] || "Unknown",
          source,
          typeOrder,
          amount: formatAmount(amount),
          timestamp,
          time: formatTime(timestamp),
          recordIndex,
        }];
      });

      // V1 records contain all five flush categories in one withdraw-summary
      // record. Expand non-zero categories into normal table rows.
      const v1Rows = v1Snapshot.records.flatMap(({ summary, flushes, recordIndex }) => {
        const timestamp = Number(summary[7] ?? 0n);
        return flushes.flatMap((amount, typeOrder) => BigInt(amount ?? 0n) === 0n ? [] : [{
          type: labels[typeOrder],
          source: "V1",
          typeOrder,
          amount: formatAmount(amount),
          timestamp,
          time: formatTime(timestamp),
          recordIndex,
        }]);
      });

      // Filter once more at the final boundary so a malformed legacy RPC
      // response can never create an empty/zero table line.
      const combinedRows = [...v1Rows, ...toRows(v2Snapshot, "V2").filter((row) => isLegacyV2HistoryVisible(row.timestamp, cutoffTimestamp)), ...toRows(v3Snapshot, "V3")]
        .filter((row) => row.type && Number(row.amount) > 0)
        .sort((a, b) => {
          if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
          if (a.recordIndex !== b.recordIndex) return b.recordIndex - a.recordIndex;
          return a.typeOrder - b.typeOrder;
        })
        .map((row, index) => ({ ...row, sno: index + 1 }));

      setRows(combinedRows);
      if (v1Result.status === "rejected" || v2Result.status === "rejected" || v3Result.status === "rejected") {
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
