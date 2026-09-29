import { TableCell } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2ReferralRegistryABI from "../../../blockchain/v2ReferralRegistryABI";
import { ReferralNetworkAddress } from "../../../blockchain/address";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import { WALLET_ADD_CHAIN_PARAMS } from "../../../blockchain/bscMainnetConfig";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import "../styles/style.css";

const V1_POWER_MANAGER_ABI = ["function powerIncomeModule() view returns(address)"];
const V1_POWER_MODULE_ABI = ["function activePowerLevel(address) view returns(uint256)"];

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
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: WALLET_ADD_CHAIN_PARAMS.chainId }],
    });
  } catch (error) {
    if (error?.code !== 4902) throw error;
    await window.ethereum.request({ method: "wallet_addEthereumChain", params: [WALLET_ADD_CHAIN_PARAMS] });
  }
}

export const PowerIncomeWithdraw = () => {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const syncPageSize = 500;
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
      const [achievedPowerRaw, achievedRewardRaw, directCount, syncState] = await Promise.all([
        registry.getAchievedPowerLevel(user),
        registry.getAchievedRewardCount(user),
        registry.getLevelUsersLength(user, 0),
        registry.getPowerRewardSync(user),
      ]);
      const achieved = Number(achievedPowerRaw);
      const v1Manager = new ethers.Contract(V1_MAINNET.packageManager, V1_POWER_MANAGER_ABI, createBscReadProvider());
      const v1PowerModule = new ethers.Contract(await v1Manager.powerIncomeModule(), V1_POWER_MODULE_ABI, createBscReadProvider());
      const v1Achieved = Number(await v1PowerModule.activePowerLevel(user));
      const achievedReward = Number(achievedRewardRaw);
      const nextLevel = achieved < 9 ? achieved + 1 : 0;
      const nextReward = achievedReward < 12 ? achievedReward + 1 : 0;
      const [qualifiedBusiness, requiredBusiness] = nextLevel
        ? await Promise.all([
            registry.powerQualifiedBusiness(user, nextLevel),
            registry.powerThreshold(nextLevel),
          ])
        : [0n, 0n];
      const [rewardQualifiedBusiness, rewardRequiredBusiness] = nextReward
        ? await Promise.all([
            registry.rewardQualifiedBusiness(user, nextReward),
            registry.rewardThreshold(nextReward),
          ])
        : [0n, 0n];

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
          const totalCounted = nextLevel && eligible
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

      // `legBusiness` includes imported V1 business. Show the V1 part first,
      // then only a real V2 increment. A zero V2 increment is intentionally hidden.
      const directRows = [
        ...directBreakdowns
          .filter((item) => item.legacyAmount > 0n)
          .map((item) => ({ source: "V1 (Legacy)", direct: item.direct, business: formatUsdt(item.legacyAmount), counted: formatUsdt(item.legacyCountedAmount), status: item.status })),
        ...directBreakdowns
          .filter((item) => item.newAmount > 0n)
          .map((item) => ({ source: "V2 (New)", direct: item.direct, business: formatUsdt(item.newAmount), counted: formatUsdt(item.newCountedAmount), status: item.status })),
      ].map((item, index) => ({ ...item, sno: index + 1 }));

      setSummary({
        achieved,
        // V2 is the authoritative display when both contracts report P1,
        // P2, etc. V1 is only a fallback / separate legacy rank.
        v1Achieved: v1Achieved && v1Achieved !== achieved ? v1Achieved : 0,
        achievedReward,
        nextLevel,
        nextReward,
        qualifiedBusiness,
        requiredBusiness,
        rewardQualifiedBusiness,
        rewardRequiredBusiness,
        remaining,
        capPerLeg,
        directCount,
        syncState,
      });
      setRows(directRows);
    } catch (error) {
      setSummary(null);
      setRows([]);
      setMessage(error?.shortMessage || error?.message || "Could not load Power business details.");
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
      await loadPowerIncome();
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
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div>
          <h1 className="mb-1">Power & Reward Rank Update</h1>
          <p className="mb-0 text-light-emphasis">Scan direct-leg business in safe pages, then unlock the next eligible rank.</p>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <button className="btn btn-primary" onClick={syncNextPowerReward} disabled={syncing}>
            {syncing ? "Updating ranks..." : "Update Power & Reward"}
          </button>
          <button className="btn btn-outline-primary" onClick={loadPowerIncome} disabled={loading || syncing}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>
      <div className="withdrawal-grid" style={{ marginBottom: "14px" }}>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Achieved Power</p><h4 className="withdrawal-card-value">{summary?.achieved ? `P${summary.achieved}` : summary?.v1Achieved ? `P${summary.v1Achieved}` : "0"}</h4></div>
        {summary?.v1Achieved ? <div className="withdrawal-card"><p className="withdrawal-card-title">V1 Power (Legacy)</p><h4 className="withdrawal-card-value">P{summary.v1Achieved}</h4></div> : null}
        <div className="withdrawal-card"><p className="withdrawal-card-title">Next Power</p><h4 className="withdrawal-card-value">{summary?.nextLevel ? `P${summary.nextLevel}` : "All achieved"}</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Qualified Business (Next Power)</p><h4 className="withdrawal-card-value">{formatUsdt(summary?.qualifiedBusiness)} USDT</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Required Business</p><h4 className="withdrawal-card-value">{formatUsdt(summary?.requiredBusiness)} USDT</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Business Remaining to Achieve</p><h4 className="withdrawal-card-value">{formatUsdt(summary?.remaining)} USDT</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Maximum Count from One Leg (40%)</p><h4 className="withdrawal-card-value">{formatUsdt(summary?.capPerLeg)} USDT</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Achieved Reward</p><h4 className="withdrawal-card-value">{summary?.achievedReward ? `R${summary.achievedReward}` : "0"}</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Next Reward</p><h4 className="withdrawal-card-value">{summary?.nextReward ? `R${summary.nextReward}` : "All achieved"}</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Qualified Business (Next Reward)</p><h4 className="withdrawal-card-value">{formatUsdt(summary?.rewardQualifiedBusiness)} USDT</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Required Reward Business</p><h4 className="withdrawal-card-value">{formatUsdt(summary?.rewardRequiredBusiness)} USDT</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Direct Legs</p><h4 className="withdrawal-card-value">{summary?.directCount?.toString?.() ?? "0"}</h4></div>
        <div className="withdrawal-card"><p className="withdrawal-card-title">Update Progress</p><h4 className="withdrawal-card-value">{summary?.syncState?.active ? `${summary.syncState.cursor.toString()} / ${summary.directCount?.toString?.()}` : "Ready"}</h4></div>
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
