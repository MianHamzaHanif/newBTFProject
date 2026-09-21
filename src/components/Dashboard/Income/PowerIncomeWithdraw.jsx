import { TableCell } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2ReferralRegistryABI from "../../../blockchain/v2ReferralRegistryABI";
import { ReferralNetworkAddress } from "../../../blockchain/address";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import "../styles/style.css";

const formatUsdt = (value) => {
  try {
    const [whole, decimals = ""] = ethers.formatEther(value ?? 0n).split(".");
    return `${whole}.${(decimals + "0000").slice(0, 4)}`;
  } catch {
    return "0.0000";
  }
};

const shortAddress = (value) => `${value.slice(0, 6)}...${value.slice(-4)}`;

export const PowerIncomeWithdraw = () => {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadPowerIncome = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");
      const user = await getReadWalletAddress();
      if (!user || !ethers.isAddress(user)) throw new Error("Please connect your wallet.");

      const registry = new ethers.Contract(
        ReferralNetworkAddress,
        V2ReferralRegistryABI,
        createBscReadProvider(),
      );
      const achieved = Number(await registry.getAchievedPowerLevel(user));
      const nextLevel = achieved < 9 ? achieved + 1 : 0;
      const [qualifiedBusiness, requiredBusiness, directCount] = nextLevel
        ? await Promise.all([
            registry.powerQualifiedBusiness(user, nextLevel),
            registry.powerThreshold(nextLevel),
            registry.getLevelUsersLength(user, 0),
          ])
        : [0n, 0n, await registry.getLevelUsersLength(user, 0)];

      const remaining = requiredBusiness > qualifiedBusiness
        ? requiredBusiness - qualifiedBusiness
        : 0n;
      const capPerLeg = (requiredBusiness * 4000n) / 10000n;
      const directAddresses = await Promise.all(
        Array.from({ length: Number(directCount) }, (_, index) =>
          registry.getLevelUserAt(user, 0, index),
        ),
      );
      const directRows = await Promise.all(
        directAddresses.map(async (direct, index) => {
          const [business, qualified] = await Promise.all([
            registry.legBusiness(user, direct),
            registry.hasQualifiedPackage(direct),
          ]);
          const counted = qualified && nextLevel
            ? (business > capPerLeg ? capPerLeg : business)
            : 0n;
          return {
            sno: index + 1,
            direct: shortAddress(direct),
            business: formatUsdt(business),
            counted: formatUsdt(counted),
            status: qualified ? "Qualified" : "No package",
          };
        }),
      );

      setSummary({ achieved, nextLevel, qualifiedBusiness, requiredBusiness, remaining, capPerLeg });
      setRows(directRows);
    } catch (error) {
      setSummary(null);
      setRows([]);
      setMessage(error?.shortMessage || error?.message || "Could not load Power business details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPowerIncome();
  }, [loadPowerIncome]);

  const columns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "direct", label: "Direct Leg", sortable: true },
    { id: "business", label: "Leg Business", sortable: true },
    { id: "counted", label: "Counted for Next Power", sortable: true },
    { id: "status", label: "Status", sortable: true },
  ];

  return (
    <div className="page-container">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="mb-0">Power Income</h1>
        <button className="btn btn-outline-primary" onClick={loadPowerIncome} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      <div className="withdrawal-grid" style={{ marginBottom: "14px" }}>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Achieved Power</p><h4 className="withdrawal-card-value">{summary?.achieved ? `P${summary.achieved}` : "0"}</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Next Power</p><h4 className="withdrawal-card-value">{summary?.nextLevel ? `P${summary.nextLevel}` : "All achieved"}</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Qualified Business (Next Power)</p><h4 className="withdrawal-card-value">{formatUsdt(summary?.qualifiedBusiness)} USDT</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Required Business</p><h4 className="withdrawal-card-value">{formatUsdt(summary?.requiredBusiness)} USDT</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Business Remaining to Achieve</p><h4 className="withdrawal-card-value">{formatUsdt(summary?.remaining)} USDT</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Maximum Count from One Leg (40%)</p><h4 className="withdrawal-card-value">{formatUsdt(summary?.capPerLeg)} USDT</h4></div>
      </div>
      {message ? <p className="text-danger">{message}</p> : null}
      <h2 className="mb-3">Direct Leg Business Details</h2>
      <CustomTable columns={columns} rows={rows} renderRow={(row) => (
        <>
          <TableCell align="center">{row.sno}</TableCell>
          <TableCell align="center">{row.direct}</TableCell>
          <TableCell align="center">{row.business} USDT</TableCell>
          <TableCell align="center">{row.counted} USDT</TableCell>
          <TableCell align="center">{row.status}</TableCell>
        </>
      )} />
    </div>
  );
};

export default PowerIncomeWithdraw;
