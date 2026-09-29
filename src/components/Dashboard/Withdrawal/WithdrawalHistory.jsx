import { TableCell } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import ReferralNetworkABI from "../../../blockchain/referralNetworkABI.json";
import V2IncomeLedgerABI from "../../../blockchain/v2IncomeLedgerABI";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import { V2LedgerAddress } from "../../../blockchain/address";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";

const READ_BATCH_SIZE = 10;

const formatAmount = (value) => {
  try {
    const [whole, fraction = ""] = ethers.formatEther(value ?? 0n).split(".");
    return `${whole}.${(fraction + "0000").slice(0, 4)}`;
  } catch {
    return "0.0000";
  }
};

const formatTime = (value) => {
  const timestamp = Number(value ?? 0n);
  return timestamp ? new Date(timestamp * 1000).toLocaleString() : "-";
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

export const WithdrawalHistory = () => {
  const [rows, setRows] = useState([]);
  const [v1Total, setV1Total] = useState("0.0000");
  const [v2Total, setV2Total] = useState("0.0000");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError("");
      const walletAddress = await getReadWalletAddress();
      if (!ethers.isAddress(walletAddress)) throw new Error("Please connect wallet to view withdrawal history.");

      const v1Referral = new ethers.Contract(
        V1_MAINNET.referralNetwork,
        ReferralNetworkABI,
        new ethers.JsonRpcProvider(V1_MAINNET.rpcUrl)
      );
      const v2Ledger = new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, createBscReadProvider());

      const [v1LengthRaw, v2LengthRaw] = await Promise.all([
        v1Referral.getUserWithdrawSummaryRecordsLength(walletAddress),
        v2Ledger.getUserWithdrawHistoryLength(walletAddress),
      ]);
      const [v1Records, v2Records] = await Promise.all([
        readInBatches(Number(v1LengthRaw), (index) => v1Referral.getUserWithdrawSummaryRecordAt(walletAddress, index)),
        readInBatches(Number(v2LengthRaw), (index) => v2Ledger.getUserWithdrawHistoryAt(walletAddress, index)),
      ]);

      const legacyRows = v1Records.map((record) => {
        const total = BigInt(record.usdAmount ?? record[6] ?? 0n);
        return {
          source: "V1 (Legacy)",
          direct: formatAmount(record.directAmount ?? record[1]),
          selfRoi: formatAmount(record.selfRoiAmount ?? record[2]),
          levelRoi: formatAmount(record.levelRoiAmount ?? record[3]),
          power: formatAmount(record.powerAmount ?? record[4]),
          reward: formatAmount(record.rewardAmount ?? record[5]),
          total: formatAmount(total),
          time: formatTime(record.timestamp ?? record[7]),
          rawTotal: total,
        };
      }).filter((row) => row.rawTotal > 0n);
      const newRows = v2Records.map((record) => {
        const total = BigInt(record.amount ?? record[0] ?? 0n);
        return {
          source: "V2 (New)",
          direct: "-",
          selfRoi: "-",
          levelRoi: "-",
          power: "-",
          reward: "-",
          total: formatAmount(total),
          time: formatTime(record.timestamp ?? record[1]),
          rawTotal: total,
        };
      }).filter((row) => row.rawTotal > 0n);

      setV1Total(formatAmount(legacyRows.reduce((sum, row) => sum + row.rawTotal, 0n)));
      setV2Total(formatAmount(newRows.reduce((sum, row) => sum + row.rawTotal, 0n)));
      setRows([...legacyRows, ...newRows].map(({ rawTotal, ...row }, index) => ({ ...row, sno: index + 1 })));
    } catch (error) {
      setRows([]);
      setV1Total("0.0000");
      setV2Total("0.0000");
      setLoadError(error?.shortMessage || error?.reason || error?.message || "Failed to load withdrawal history.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const columns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "direct", label: "Direct", sortable: true },
    { id: "selfRoi", label: "Self ROI", sortable: true },
    { id: "levelRoi", label: "Level ROI", sortable: true },
    { id: "power", label: "Power", sortable: true },
    { id: "reward", label: "Reward", sortable: true },
    { id: "total", label: "Withdrawn USDT", sortable: true },
    { id: "time", label: "Time", sortable: true },
  ];

  return (
    <div className="page-container">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="mb-0">Withdrawal History</h1>
        <button className="btn btn-outline-primary" onClick={loadHistory} disabled={isLoading}>{isLoading ? "Loading..." : "Refresh"}</button>
      </div>
      <div className="withdrawal-grid mb-4">
        <div className="withdrawal-card"><p className="withdrawal-card-title">V1 Legacy Withdrawn</p><h4 className="withdrawal-card-value">{v1Total} USDT</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">V2 New Withdrawn</p><h4 className="withdrawal-card-value">{v2Total} USDT</h4></div>
      </div>
      <div className="table-wrapper"><div className="table-card">
        {isLoading && <p className="team-loading">Loading V1 and V2 withdrawal history...</p>}
        {!isLoading && loadError && <p className="team-loading">{loadError}</p>}
        <CustomTable columns={columns} rows={rows} renderRow={(row) => (
          <>
            <TableCell align="center">{row.sno}</TableCell>
            <TableCell align="center">{row.direct}</TableCell>
            <TableCell align="center">{row.selfRoi}</TableCell>
            <TableCell align="center">{row.levelRoi}</TableCell>
            <TableCell align="center">{row.power}</TableCell>
            <TableCell align="center">{row.reward}</TableCell>
            <TableCell align="center">{row.total}</TableCell>
            <TableCell align="center" className="team-time-cell">{row.time}</TableCell>
          </>
        )} />
      </div></div>
    </div>
  );
};

export default WithdrawalHistory;
