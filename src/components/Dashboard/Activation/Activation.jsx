import { TableCell } from "@mui/material";
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import { SettlementTokenSymbol } from "../../../blockchain/address";
import { loadPrioritizedPackageHistory } from "../../../blockchain/prioritizedPackageHistory";
import { getReadWalletAddress } from "../../../blockchain/readProvider";
import "../styles/style.css";

const sum = (records, read) => records.reduce((total, record) => total + BigInt(read(record) ?? 0n), 0n);
const formatAmount = (value) => {
  try { return Number(ethers.formatEther(value ?? 0n)).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }); }
  catch { return "0.0000"; }
};
const formatTime = (value) => Number(value ?? 0n) ? new Date(Number(value) * 1000).toLocaleString() : "-";
const tokenFor = (source) => source === "V3" ? SettlementTokenSymbol : "USDT";

// Package Activation and Activation History intentionally use the same shared
// reader. A package visible as V3 here can never be counted again as V2/V1.
export const Activation = () => {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true); setMessage("");
        const wallet = await getReadWalletAddress();
        const { records, failures } = await loadPrioritizedPackageHistory(wallet);
        const active = records.filter((record) => record.active);
        const knownUsed = records.filter((record) => record.usedIncome !== null);
        const knownLimit = sum(knownUsed, (record) => record.incomeLimit);
        const knownUsedAmount = sum(knownUsed, (record) => record.usedIncome);
        if (cancelled) return;

        setRows(records.map((record, index) => ({
          ...record, sno: index + 1,
          packageAmount: `${formatAmount(record.amount)} ${tokenFor(record.source)}`,
          purchasedAt: formatTime(record.timestamp), roiMaximum: `${formatAmount(record.maximum)} ${tokenFor(record.source)}`,
          usedIncomeDisplay: record.usedIncome === null ? "-" : `${formatAmount(record.usedIncome)} ${tokenFor(record.source)}`,
          status: record.active ? (record.generated < record.maximum ? "Active - ROI Running" : "Active - Self ROI Complete") : "Inactive",
          roiStatus: record.active && record.generated < record.maximum ? "Yes" : "No",
        })));
        setSummary({
          visiblePackages: records.length,
          activePackages: active.length,
          totalAmount: sum(records, (record) => record.amount),
          activeAmount: sum(active, (record) => record.amount),
          totalSelfRoiLimit: sum(records, (record) => record.maximum),
          activeIncomeLimit: sum(active, (record) => record.incomeLimit),
          // Used value is shown only where the contract exposes a reliable
          // per-package figure; no aggregate is incorrectly assigned to rows.
          knownUsedAmount,
          knownRemaining: knownLimit > knownUsedAmount ? knownLimit - knownUsedAmount : 0n,
          knownUsedCount: knownUsed.length,
        });
        setMessage(failures.length ? `${failures.join(". ")}. Other available package data is shown.` : records.length ? "" : "No V1, V2 or V3 package has been purchased yet.");
      } catch (error) {
        if (!cancelled) { setRows([]); setSummary(null); setMessage(error?.shortMessage || error?.reason || error?.message || "Unable to load activation details."); }
      } finally { if (!cancelled) setIsLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const columns = [
    { id: "sno", label: "S. No", sortable: true }, { id: "packageAmount", label: "Package Amount", sortable: true },
    { id: "purchasedAt", label: "Purchased At", sortable: true }, { id: "usedIncomeDisplay", label: "Used Limit", sortable: true },
    { id: "roiMaximum", label: "Self ROI 3x Limit", sortable: true }, { id: "status", label: "Package Status", sortable: true },
    { id: "roiStatus", label: "Self ROI Active", sortable: true },
  ];

  return <div className="page-container"><h1>Activation Package</h1>
    {summary && <div className="withdrawal-grid mb-4">
      <div className="withdrawal-card"><p className="withdrawal-card-title">Visible Packages</p><h4 className="withdrawal-card-value">{summary.visiblePackages}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Active Packages</p><h4 className="withdrawal-card-value">{summary.activePackages}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Total Package Amount</p><h4 className="withdrawal-card-value">{formatAmount(summary.totalAmount)}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Active Package Amount</p><h4 className="withdrawal-card-value">{formatAmount(summary.activeAmount)}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Self ROI 3x Limit</p><h4 className="withdrawal-card-value">{formatAmount(summary.totalSelfRoiLimit)}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Active Income Limit</p><h4 className="withdrawal-card-value">{formatAmount(summary.activeIncomeLimit)}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Known Used Limit</p><h4 className="withdrawal-card-value">{formatAmount(summary.knownUsedAmount)}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Known Remaining Limit</p><h4 className="withdrawal-card-value">{formatAmount(summary.knownRemaining)}</h4></div>
    </div>}
    <div className="table-wrapper"><div className="table-card">
      {isLoading && <p className="team-loading">Loading V1, V2 and V3 package details...</p>}
      {!isLoading && message && <p className="team-loading">{message}</p>}
      <CustomTable columns={columns} rows={rows} renderRow={(row) => <>
        <TableCell align="center">{row.sno}</TableCell><TableCell align="center">{row.packageAmount}</TableCell><TableCell align="center">{row.purchasedAt}</TableCell><TableCell align="center">{row.usedIncomeDisplay}</TableCell>
        <TableCell align="center">{row.roiMaximum}</TableCell><TableCell align="center">{row.status}</TableCell><TableCell align="center">{row.roiStatus}</TableCell>
      </>} />
    </div></div>
  </div>;
};

export default Activation;
