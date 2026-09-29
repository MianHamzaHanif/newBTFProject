import { TableCell } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2ReferralRegistryABI from "../../../blockchain/v2ReferralRegistryABI";
import { ReferralNetworkAddress } from "../../../blockchain/address";
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

      const registry = new ethers.Contract(
        ReferralNetworkAddress,
        V2ReferralRegistryABI,
        createBscReadProvider(),
      );
      const achieved = Number(await registry.getAchievedRewardCount(user));
      const nextIndex = achieved < 12 ? achieved + 1 : 0;
      const [qualifiedBusiness, requiredBusiness, directCount] = nextIndex
        ? await Promise.all([
            registry.rewardQualifiedBusiness(user, nextIndex),
            registry.rewardThreshold(nextIndex),
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
      const directBreakdowns = await Promise.all(
        directAddresses.map(async (direct, index) => {
          const [business, legacyBusiness, qualified, legacyCounted, everPackage] = await Promise.all([
            registry.legBusiness(user, direct),
            registry.legacyLegBusiness(user, direct),
            registry.hasQualifiedPackage(direct),
            registry.legacyDirectCounted(direct).catch(() => false),
            registry.hasEverPackage(direct).catch(() => true),
          ]);
          const eligible = legacyCounted || everPackage;
          const legacyAmount = BigInt(legacyBusiness);
          const totalAmount = BigInt(business);
          const newAmount = totalAmount > legacyAmount ? totalAmount - legacyAmount : 0n;
          const totalCounted = nextIndex && eligible
            ? (totalAmount > capPerLeg ? capPerLeg : totalAmount)
            : 0n;
          const legacyCountedAmount = legacyAmount > totalCounted ? totalCounted : legacyAmount;
          return {
            direct: shortAddress(direct),
            legacyAmount,
            newAmount,
            legacyCountedAmount,
            newCountedAmount: totalCounted - legacyCountedAmount,
            status: qualified ? "Active package" : eligible ? "Lifetime business counted" : "No own package",
          };
        }),
      );

      // The V2 total already contains the V1 imported amount. Split it so a
      // V2 zero row is never shown when that direct only has legacy business.
      const directRows = [
        ...directBreakdowns
          .filter((item) => item.legacyAmount > 0n)
          .map((item) => ({ source: "V1 (Legacy)", direct: item.direct, business: formatUsdt(item.legacyAmount), counted: formatUsdt(item.legacyCountedAmount), status: item.status })),
        ...directBreakdowns
          .filter((item) => item.newAmount > 0n)
          .map((item) => ({ source: "V2 (New)", direct: item.direct, business: formatUsdt(item.newAmount), counted: formatUsdt(item.newCountedAmount), status: item.status })),
      ].map((item, index) => ({ ...item, sno: index + 1 }));

      setSummary({ achieved, nextIndex, qualifiedBusiness, requiredBusiness, remaining, capPerLeg });
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
    { id: "source", label: "Source", sortable: true },
    { id: "direct", label: "Direct Leg", sortable: true },
    { id: "business", label: "Leg Business", sortable: true },
    { id: "counted", label: "Counted for Next Reward", sortable: true },
    { id: "status", label: "Status", sortable: true },
  ];

  return (
    <div className="page-container">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <h1 className="mb-0">Reward Income</h1>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-primary" onClick={syncNextPowerReward} disabled={syncing}>
            {syncing ? "Updating ranks..." : "Update Power & Reward"}
          </button>
          <button className="btn btn-outline-primary" onClick={loadRewardDetails} disabled={loading || syncing}>
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
            <TableCell align="center">{row.source}</TableCell>
            <TableCell align="center">{row.direct}</TableCell>
            <TableCell align="center">{row.business} USDT</TableCell>
            <TableCell align="center">{row.counted} USDT</TableCell>
            <TableCell align="center">{row.status}</TableCell>
          </>
        )}
      />
    </div>
  );
};

export default Income5;
