import { TableCell } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2ReferralRegistryABI from "../../../blockchain/v2ReferralRegistryABI";
import PackageManagerABI from "../../../blockchain/packageMangerABI.json";
import V2PackageManagerABI from "../../../blockchain/v2PackageManagerABI";
import { PackageManagerAddress, ReferralNetworkAddress } from "../../../blockchain/address";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import { WALLET_ADD_CHAIN_PARAMS } from "../../../blockchain/bscMainnetConfig";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import "../styles/style.css";

const V1_REWARD_MANAGER_ABI = ["function rewardAchievedAt(address user,uint256 index) view returns(uint256)"];
const V1_DIRECT_READER_ABI = [
  "function users(address) view returns(uint256 id,address referral,uint256 registeredAt,uint256 totalTeam,uint256 totalTeamDeposit,uint256 selfDeposit,uint256 totalTeamStakeToken,uint256 selfStakeToken,bool exists)",
  "function getLevelUsersLength(address upline,uint256 level) view returns(uint256)",
  "function getLevelUserAt(address upline,uint256 level,uint256 index) view returns(address)",
];

const formatUsdt = (value) => {
  try {
    const [whole, decimals = ""] = ethers.formatEther(value ?? 0n).split(".");
    return `${whole}.${(decimals + "0000").slice(0, 4)}`;
  } catch {
    return "0.0000";
  }
};

const shortAddress = (value) => `${value.slice(0, 6)}...${value.slice(-4)}`;

const createV1ReadProvider = () => {
  const request = new ethers.FetchRequest(V1_MAINNET.rpcUrl);
  request.timeout = 30_000;
  return new ethers.JsonRpcProvider(request, V1_MAINNET.chainId, { staticNetwork: true, batchMaxCount: 1, batchStallTime: 0 });
};

const combinedPackageBusiness = async (address, v1Manager, v2Manager) => {
  const [v1LengthRaw, v2LengthRaw] = await Promise.all([
    v1Manager.getStakeHistoryLength(address).catch(() => 0n), v2Manager.getPackageHistoryLength(address).catch(() => 0n),
  ]);
  const [v1Stakes, v2Packages] = await Promise.all([
    Promise.all(Array.from({ length: Number(v1LengthRaw) }, (_, index) => v1Manager.userStakeHistory(address, index))),
    Promise.all(Array.from({ length: Number(v2LengthRaw) }, (_, index) => v2Manager.getPackageHistoryAt(address, index))),
  ]);
  const importedKeys = new Map();
  const v1Total = v1Stakes.reduce((total, stake) => {
    const amount = BigInt(stake?.packageValue ?? stake?.[0] ?? 0n), timestamp = BigInt(stake?.timestamp ?? stake?.[7] ?? 0n);
    const key = `${amount}:${timestamp}`;
    importedKeys.set(key, (importedKeys.get(key) || 0) + 1);
    return total + amount;
  }, 0n);
  return v1Total + v2Packages.reduce((total, record) => {
    const amount = BigInt(record?.amount ?? record?.[0] ?? 0n), timestamp = BigInt(record?.purchasedAt ?? record?.[1] ?? 0n);
    const key = `${amount}:${timestamp}`, imported = importedKeys.get(key) || 0;
    if (imported) { importedKeys.set(key, imported - 1); return total; }
    return total + amount;
  }, 0n);
};

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
      const v1Provider = createV1ReadProvider();
      const v1RewardManager = new ethers.Contract(V1_MAINNET.packageManager, V1_REWARD_MANAGER_ABI, v1Provider);
      const v1RewardTimes = await Promise.all(Array.from({ length: 12 }, (_, offset) => v1RewardManager.rewardAchievedAt(user, offset + 1)));
      const v1Registry = new ethers.Contract(V1_MAINNET.referralNetwork, V1_DIRECT_READER_ABI, v1Provider);
      const v1Manager = new ethers.Contract(V1_MAINNET.packageManager, PackageManagerABI, v1Provider);
      const v2Manager = new ethers.Contract(PackageManagerAddress, V2PackageManagerABI, createBscReadProvider());
      const v1Achieved = v1RewardTimes.reduce((highest, achievedAt, offset) => BigInt(achievedAt) > 0n ? offset + 1 : highest, 0);
      const nextIndex = achieved < 12 ? achieved + 1 : 0;
      const [qualifiedBusiness, requiredBusiness] = nextIndex
        ? await Promise.all([
          registry.rewardQualifiedBusiness(user, nextIndex),
          registry.rewardThreshold(nextIndex),
        ])
        : [0n, 0n];

      const remaining = requiredBusiness > qualifiedBusiness
        ? requiredBusiness - qualifiedBusiness
        : 0n;
      const capPerLeg = (requiredBusiness * 4000n) / 10000n;
      const [v1DirectResult, v2DirectResult] = await Promise.allSettled([
        (async () => {
          const count = Number(await v1Registry.getLevelUsersLength(user, 0));
          return Promise.all(Array.from({ length: count }, (_, index) => v1Registry.getLevelUserAt(user, 0, index)));
        })(),
        (async () => {
          const count = Number(await registry.getLevelUsersLength(user, 0));
          return Promise.all(Array.from({ length: count }, (_, index) => registry.getLevelUserAt(user, 0, index)));
        })(),
      ]);
      const directMap = new Map();
      for (const address of v1DirectResult.status === "fulfilled" ? v1DirectResult.value : []) directMap.set(address.toLowerCase(), { address, inV1: true, inV2: false });
      for (const address of v2DirectResult.status === "fulfilled" ? v2DirectResult.value : []) {
        const prior = directMap.get(address.toLowerCase());
        directMap.set(address.toLowerCase(), { address, inV1: prior?.inV1 ?? false, inV2: true });
      }
      const directRows = await Promise.all(Array.from(directMap.values()).map(async (member, index) => {
        const [v1User, v2User, selfBusiness, qualified, legacyCounted, everPackage] = await Promise.all([
          member.inV1 ? v1Registry.users(member.address).catch(() => null) : null,
          member.inV2 ? registry.users(member.address).catch(() => null) : null,
          combinedPackageBusiness(member.address, v1Manager, v2Manager).catch(() => 0n),
          member.inV2 ? registry.hasQualifiedPackage(member.address).catch(() => false) : false,
          member.inV2 ? registry.legacyDirectCounted(member.address).catch(() => false) : false,
          member.inV2 ? registry.hasEverPackage(member.address).catch(() => true) : true,
        ]);
        const teamBusiness = BigInt(v1User?.totalTeamDeposit ?? v1User?.[4] ?? 0n) + BigInt(v2User?.totalTeamDeposit ?? v2User?.[4] ?? 0n);
        const legBusiness = BigInt(selfBusiness) + teamBusiness;
        const eligible = legacyCounted || everPackage;
        const counted = nextIndex && eligible ? (legBusiness > capPerLeg ? capPerLeg : legBusiness) : 0n;
        return { sno: index + 1, direct: shortAddress(member.address), selfBusiness: formatUsdt(selfBusiness), teamBusiness: formatUsdt(teamBusiness), business: formatUsdt(legBusiness), counted: formatUsdt(counted), status: qualified ? "Active package" : eligible ? "Lifetime business counted" : "No own package" };
      }));

      setSummary({
        achieved,
        // Do not show a legacy R1 separately if V2 already has R1. V1 is a
        // fallback or a distinct higher/lower historical reward record.
        v1Achieved: v1Achieved && v1Achieved !== achieved ? v1Achieved : 0,
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
    { id: "selfBusiness", label: "Direct Business", sortable: true },
    { id: "teamBusiness", label: "Team Business", sortable: true },
    { id: "business", label: "Leg Business", sortable: true },
    { id: "counted", label: "Counted for Next Reward", sortable: true },
    { id: "status", label: "Status", sortable: true },
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
        <div className="withdrawal-card"><p className="withdrawal-card-title">Achieved Reward</p><h4 className="withdrawal-card-value">{summary?.achieved ? `R${summary.achieved}` : summary?.v1Achieved ? `R${summary.v1Achieved}` : "0"}</h4></div>
        {summary?.v1Achieved ? <div className="withdrawal-card"><p className="withdrawal-card-title">V1 Reward (Legacy)</p><h4 className="withdrawal-card-value">R{summary.v1Achieved}</h4></div> : null}
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
