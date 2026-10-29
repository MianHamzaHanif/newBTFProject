import { TableCell } from "@mui/material";
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import { SettlementTokenSymbol } from "../../../blockchain/address";
import { loadPrioritizedPackageHistory } from "../../../blockchain/prioritizedPackageHistory";
import { getReadWalletAddress } from "../../../blockchain/readProvider";

const formatAmount = (value) => {
  try { return Number(ethers.formatEther(value ?? 0n)).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }); }
  catch { return "0.0000"; }
};
const formatTime = (value) => Number(value ?? 0n) ? new Date(Number(value) * 1000).toLocaleString() : "-";
const tokenFor = (source) => source === "V3" ? SettlementTokenSymbol : "USDT";

export const ActivationHistory = () => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadMessage, setLoadMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true); setLoadMessage("");
        const wallet = await getReadWalletAddress();
        const { records, failures } = await loadPrioritizedPackageHistory(wallet);
        if (cancelled) return;
        setRows(records.map((record, index) => ({
          ...record, sno: index + 1, purchasedAt: formatTime(record.timestamp),
          package: `${formatAmount(record.amount)} ${tokenFor(record.source)}`,
          income: `${formatAmount(record.generated)} / ${formatAmount(record.maximum)} ${tokenFor(record.source)}`,
          status: record.active ? (record.generated < record.maximum ? "Active" : "Self ROI Complete") : "Inactive",
        })));
        setLoadMessage(failures.length ? `${failures.join(". ")}. Other available package history is shown.` : records.length ? "" : "No V1, V2 or V3 activation package found.");
      } catch (error) {
        if (!cancelled) { setRows([]); setLoadMessage(error?.shortMessage || error?.reason || error?.message || "Failed to load activation history."); }
      } finally { if (!cancelled) setIsLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const columns = [
    { id: "sno", label: "S. No", sortable: true }, { id: "package", label: "Package", sortable: true },
    { id: "purchasedAt", label: "Purchase Date", sortable: true }, { id: "usedIncome", label: "Used Limit", sortable: true },
    { id: "income", label: "ROI Generated / Limit", sortable: true }, { id: "status", label: "Status", sortable: true },
  ];

  return <div className="page-container"><h1>Activation History</h1><div className="table-wrapper"><div className="table-card">
    {isLoading && <p className="team-loading">Loading V1, V2 and V3 package history...</p>}
    {!isLoading && loadMessage && <p className="team-loading">{loadMessage}</p>}
    <CustomTable columns={columns} rows={rows} renderRow={(row) => <>
      <TableCell align="center">{row.sno}</TableCell><TableCell align="center">{row.package}</TableCell><TableCell align="center">{row.purchasedAt}</TableCell>
      <TableCell align="center">{row.usedIncome === null ? "-" : `${formatAmount(row.usedIncome)} ${tokenFor(row.source)}`}</TableCell>
      <TableCell align="center">{row.income}</TableCell><TableCell align="center"><span className={`${row.status === "Active" ? "active" : "in-active"} status`}>{row.status}</span></TableCell>
    </>} />
  </div></div></div>;
};

export default ActivationHistory;
