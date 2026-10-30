import { TableCell } from "@mui/material";
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import { SettlementTokenSymbol } from "../../../blockchain/address";
import { loadPrioritizedPackageHistory } from "../../../blockchain/prioritizedPackageHistory";
import { getReadWalletAddress } from "../../../blockchain/readProvider";
import "../styles/style.css";

const sum = (records, read) => records.reduce((total, record) => total + BigInt(read(record) ?? 0n), 0n);
const percent = (numerator, denominator) => {
  const top = BigInt(numerator ?? 0n);
  const bottom = BigInt(denominator ?? 0n);
  return bottom === 0n ? "0.00" : (Number((top * 10000n) / bottom) / 100).toFixed(2);
};
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
        const { records, failures, sourceTotals } = await loadPrioritizedPackageHistory(wallet);
        const active = records.filter((record) => record.active);
        const activeV1 = active.filter((record) => record.source === "V1");
        const inactiveLimitFor = (sourceName) => sum(
          records.filter((record) => record.source === sourceName && !record.active),
          (record) => record.incomeLimit,
        );
        const activeUsedFor = (aggregateUsed, sourceName) => {
          const inactiveUsed = inactiveLimitFor(sourceName);
          return aggregateUsed > inactiveUsed ? aggregateUsed - inactiveUsed : 0n;
        };
        const v3Rows = records.filter((record) => record.source === "V3");
        const v3AggregateLimit = BigInt(sourceTotals.v3AggregateLimit ?? 0n);
        const v3AggregateUsed = BigInt(sourceTotals.v3AggregateUsed ?? 0n);

        // A migrated V2 package may have no V3 history row, but its current
        // limit/usage is already stored in V3. In that case V2 is only a
        // history fallback: adding both aggregates counts the same use twice.
        // Once V3 has a package row, its aggregate cap/usage is the current
        // authoritative state for migrated packages. Adding V2's aggregate
        // again doubles the same migrated usage (e.g. 305.0625 -> 610.125).
        const v3OwnsMigratedState = v3Rows.length > 0 && v3AggregateLimit > 0n;
        const activeIncomeUsed = v3OwnsMigratedState
          ? v3AggregateUsed
          : sum(activeV1, (record) => record.usedIncome)
            + activeUsedFor(BigInt(sourceTotals.v2AggregateUsed), "V2")
            + activeUsedFor(v3AggregateUsed, "V3");
        const activeIncomeLimit = v3OwnsMigratedState
          ? v3AggregateLimit
          : sum(active, (record) => record.incomeLimit);
        if (cancelled) return;

        setRows(records.map((record, index) => ({
          ...record, sno: index + 1,
          packageAmount: formatAmount(record.amount),
          purchasedAt: formatTime(record.timestamp), roiMaximum: `${formatAmount(record.maximum)} ${tokenFor(record.source)}`,
          usedIncomeDisplay: record.usedIncome === null ? "-" : `${formatAmount(record.usedIncome)} ${tokenFor(record.source)}`,
          status: record.active ? (record.generated < record.maximum ? "Active - ROI Running" : "Active - Self ROI Complete") : "Inactive",
          roiStatus: record.active && record.generated < record.maximum ? "Yes" : "No",
        })));
        setSummary({
          // Keep the original UI cards, but calculate every value from the
          // single de-duplicated V3 -> V2 -> V1 package list above.
          totalRoiPackageAmount: sum(records, (record) => record.amount),
          activePackagesAmount: sum(active, (record) => record.amount),
          pendingRoi: BigInt(sourceTotals.v1Claimable) + BigInt(sourceTotals.v2PendingSelfRoi) + BigInt(sourceTotals.v3PendingSelfRoi),
          roiMaximum: sum(records, (record) => record.maximum),
          // Keep the legacy dashboard behaviour: all historical generated
          // ROI is shown against the 3x target of packages still active.
          // For example, 41.375 / 450 is displayed as 9.19%.
          roiProgress: `${percent(sum(records, (record) => record.generated), sum(active, (record) => record.maximum))}% / 100.00%`,
          allPackagesIncomeLimit: sum(records, (record) => record.incomeLimit),
          activePackagesIncomeLimit: activeIncomeLimit,
          activePackagesIncomeUsed: activeIncomeUsed,
          activePackagesIncomeRemaining: activeIncomeLimit > activeIncomeUsed
            ? activeIncomeLimit - activeIncomeUsed : 0n,
          roiDay: sourceTotals.v3RoiDay || sourceTotals.v2RoiDay,
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
      <div className="withdrawal-card"><p className="withdrawal-card-title">Total Amount Receiving Self ROI</p><h4 className="withdrawal-card-value">{formatAmount(summary.totalRoiPackageAmount)}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Active Packages Total</p><h4 className="withdrawal-card-value">{formatAmount(summary.activePackagesAmount)}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Self ROI Claimable</p><h4 className="withdrawal-card-value">{formatAmount(summary.pendingRoi)}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Self ROI 3x Limit</p><h4 className="withdrawal-card-value">{formatAmount(summary.roiMaximum)}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Self ROI Progress / Target</p><h4 className="withdrawal-card-value">{summary.roiProgress}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Overall Income Claim Limit (All Packages)</p><h4 className="withdrawal-card-value">{formatAmount(summary.allPackagesIncomeLimit)}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Package Active Income Claim Limit</p><h4 className="withdrawal-card-value">{formatAmount(summary.activePackagesIncomeLimit)}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Package Active Income Limit Used</p><h4 className="withdrawal-card-value">{formatAmount(summary.activePackagesIncomeUsed)}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Package Active Income Limit Remaining</p><h4 className="withdrawal-card-value">{formatAmount(summary.activePackagesIncomeRemaining)}</h4></div>
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
