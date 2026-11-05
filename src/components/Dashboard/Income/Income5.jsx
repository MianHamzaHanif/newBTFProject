import { TableCell } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2ReferralRegistryABI from "../../../blockchain/v2ReferralRegistryABI";
import {
  ReferralNetworkAddress,
} from "../../../blockchain/address";
import { WALLET_ADD_CHAIN_PARAMS } from "../../../blockchain/bscMainnetConfig";
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

async function ensureBscMainnet() {
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (BigInt(chainId) === BigInt(WALLET_ADD_CHAIN_PARAMS.chainId)) return;
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: WALLET_ADD_CHAIN_PARAMS.chainId }] });
  } catch (error) {
    if (error?.code !== 4902) throw error;
    await window.ethereum.request({ method: "wallet_addEthereumChain", params: [WALLET_ADD_CHAIN_PARAMS] });
  }
}

export const Income5 = () => {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const syncPageSize = 500;
  const [message, setMessage] = useState("");

  const loadRewardDetails = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");
      const user = await getReadWalletAddress();
      if (!user || !ethers.isAddress(user)) throw new Error("Please connect your wallet.");
      if (!ethers.isAddress(ReferralNetworkAddress)) throw new Error("V2 Registry address is not configured.");

      const provider = createBscReadProvider();
      const registry = new ethers.Contract(
        ReferralNetworkAddress,
        V2ReferralRegistryABI,
        provider,
      );
      const achieved = Number(await registry.getAchievedRewardCount(user));
      const nextIndex = achieved < 12 ? achieved + 1 : 0;
      const requiredBusiness = nextIndex
        ? await registry.rewardThreshold(nextIndex)
        : 0n;
      const capPerLeg = (requiredBusiness * 4000n) / 10000n;
      const directCount = Number(await registry.getLevelUsersLength(user, 0));
      const directs = await Promise.all(
        Array.from({ length: directCount }, (_, index) => registry.getLevelUserAt(user, 0, index)),
      );
      const directRows = await Promise.all(directs.map(async (direct, index) => {
        const [selfBusiness, teamBusiness, legBusiness, hasEverPackage, legacyDirectCounted] = await Promise.all([
          registry.legSelfBusiness(user, direct),
          registry.legTeamBusiness(user, direct),
          registry.legBusiness(user, direct),
          registry.hasEverPackage(direct),
          registry.legacyDirectCounted(direct),
        ]);
        // Match BTFReferralRegistry._syncNextPowerReward exactly.  An
        // unqualified direct's team business is visible in the detail table,
        // but must not be included in qualified Reward business.
        const eligible = hasEverPackage || legacyDirectCounted;
        const counted = eligible && nextIndex
          ? (legBusiness > capPerLeg ? capPerLeg : legBusiness)
          : 0n;
        return { sno: index + 1, direct: shortAddress(direct), selfBusiness: formatUsdt(selfBusiness), teamBusiness: formatUsdt(teamBusiness), business: formatUsdt(legBusiness), counted: formatUsdt(counted), countedRaw: counted };
      }));
      const qualifiedBusiness = directRows.reduce((total, row) => total + row.countedRaw, 0n);
      const remaining = requiredBusiness > qualifiedBusiness
        ? requiredBusiness - qualifiedBusiness
        : 0n;

      setSummary({
        achieved,
        nextIndex,
        qualifiedBusiness,
        requiredBusiness,
        remaining,
        capPerLeg,
      });
      setRows(directRows);
    } catch (error) {
      setSummary(null);
      setRows([]);
      setMessage(error?.shortMessage || error?.message || "Could not load Reward business details.");
    } finally {
      setLoading(false);
    }
  }, []);

  const syncNextPowerReward = async () => {
    if (!window.ethereum) {
      setMessage("MetaMask or Trust Wallet is not available.");
      return;
    }
    try {
      setSyncing(true);
      setMessage("Confirm the Power/Reward update transaction in your wallet.");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureBscMainnet();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const user = await signer.getAddress();
      const registry = new ethers.Contract(ReferralNetworkAddress, V2ReferralRegistryABI, signer);
      const tx = await registry.syncMyNextPowerReward(syncPageSize);
      setMessage("Power/Reward update submitted. Waiting for confirmation...");
      await tx.wait();
      const [progress, total] = await Promise.all([
        registry.getPowerRewardSync(user),
        registry.getLevelUsersLength(user, 0),
      ]);
      setMessage(progress.active
        ? `Saved ${progress.cursor.toString()} of ${total.toString()} direct legs. Click Update again to continue.`
        : "Next Power and Reward ranks have been checked successfully.");
      window.dispatchEvent(new Event("btf:v2-data-changed"));
      await loadRewardDetails();
    } catch (error) {
      const reason = error?.shortMessage || error?.message || "";
      setMessage(reason.includes("LEGACY_LEGS")
        ? "Owner must finish importing your V1 direct-leg business before Power/Reward update."
        : reason.includes("OWN_PACKAGE")
          ? "An own package is required before Power/Reward rank update."
          : reason || "Could not update Power/Reward ranks.");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadRewardDetails();
  }, [loadRewardDetails]);

  const columns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "direct", label: "Direct Leg", sortable: true },
    { id: "selfBusiness", label: "Direct Self Business", sortable: true },
    { id: "teamBusiness", label: "Direct Team Business", sortable: true },
  ];
  return (
    <div className="page-container">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <h1 className="mb-0">Reward Income</h1>
        <div className="power-rank-actions">
          <button className="power-rank-action power-rank-action-primary" onClick={syncNextPowerReward} disabled={syncing}>
            {syncing ? "Updating ranks..." : "Update Power & Reward"}
          </button>
          <button className="power-rank-action power-rank-action-secondary" onClick={loadRewardDetails} disabled={loading || syncing}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="withdrawal-grid" style={{ marginBottom: "14px" }}>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Achieved Reward</p><h4 className="withdrawal-card-value">{summary?.achieved ? `R${summary.achieved}` : "0"}</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Next Reward</p><h4 className="withdrawal-card-value">{summary?.nextIndex ? `R${summary.nextIndex}` : "All achieved"}</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Qualified Business (Next Reward)</p><h4 className="withdrawal-card-value">{formatUsdt(summary?.qualifiedBusiness)} USDT</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Required Business</p><h4 className="withdrawal-card-value">{formatUsdt(summary?.requiredBusiness)} USDT</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Business Remaining to Achieve</p><h4 className="withdrawal-card-value">{formatUsdt(summary?.remaining)} USDT</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Maximum Count from One Leg (40%)</p><h4 className="withdrawal-card-value">{formatUsdt(summary?.capPerLeg)} USDT</h4></div>
      </div>

      {message ? <p className="text-danger">{message}</p> : null}
      <h2 className="mb-3">Direct Leg Business Details</h2>
      <CustomTable
        columns={columns}
        rows={rows}
        renderRow={(row) => (
          <>
            <TableCell align="center">{row.sno}</TableCell>
            <TableCell align="center">{row.direct}</TableCell>
            <TableCell align="center">{row.selfBusiness} USDT</TableCell>
            <TableCell align="center">{row.teamBusiness} USDT</TableCell>
          </>
        )}
      />
    </div>
  );
};

export default Income5;
