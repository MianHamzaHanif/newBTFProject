import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { useLocation } from "react-router-dom";
import V2IncomeLedgerABI from "../../../blockchain/v2IncomeLedgerABI";
import { V2LedgerAddress } from "../../../blockchain/address";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import { WALLET_ADD_CHAIN_PARAMS } from "../../../blockchain/bscMainnetConfig";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";

// These users must use their designated withdrawal route; never render the
// V1 withdrawal panel for them. All other users can see it only when they
// are actually registered in V1.
const V1_WITHDRAWAL_HIDDEN_USERS = new Set([
  "0x029FE1A6a6D4dD7ef8537701ab6530a2d64a87FD",
  "0xd9EEdcB4f9E1652dA9569A0a97F2A083b51663a1",
  "0xCFAe3b54B5e03c876748153Fd286c99768dd0A49",
  "0x7fDcCf72eEcda00125D240Ce4f1F788a1045DAf4",
].map((address) => address.toLowerCase()));
const V1_MIN_WITHDRAWAL = 10n ** 19n; // 10 USDT, token has 18 decimals
const V1_WITHDRAWAL_CAP_BP = 90n;

const formatUsdt = (value) => {
  try {
    const [whole, decimals = ""] = ethers.formatEther(value ?? 0n).split(".");
    return `${whole}.${(decimals + "0000").slice(0, 4)}`;
  } catch {
    return "0.0000";
  }
};

const formatTime = (value) => {
  const timestamp = Number(value ?? 0n);
  return timestamp ? new Date(timestamp * 1000).toLocaleString() : "-";
};

const V1_MANAGER_ABI = [
  "function pendingDirectIncomeToken(address) view returns(uint256)",
  "function totalDirectIncomeToken(address) view returns(uint256)",
  "function totalSelfRoiIncomeClaimed(address) view returns(uint256)",
  "function totalLevelRoiClaimed(address) view returns(uint256)",
  "function totalPowerIncomeClaimed(address) view returns(uint256)",
  "function totalRewardIncomeClaimed(address) view returns(uint256)",
  "function totalPackageValue(address) view returns(uint256)",
  "function getStakeHistoryLength(address) view returns(uint256)",
  "function getStakeIncomeStatus(address,uint256) view returns(uint256 incomeLimit,uint256 usedIncome,uint256 remainingIncome,bool completed)",
  "function powerIncomeModule() view returns(address)",
  "function rewardIncomeModule() view returns(address)",
  "function withdrawIncome() external",
];
const V1_REFERRAL_ABI = [
  "function users(address) view returns(uint256 id,address referral,uint256 registeredAt,uint256 totalTeam,uint256 totalTeamDeposit,uint256 selfDeposit,uint256 totalTeamStakeToken,uint256 selfStakeToken,bool exists)",
  "function getSelfRoiClaimableFor(address) view returns(uint256)",
  "function getTotalLevelRoiClaimableFor(address) view returns(uint256)",
];
const V1_RANK_MODULE_ABI = ["function rawClaimable(address) view returns(uint256)"];

const ensureBscMainnet = async () => {
  const currentChain = await window.ethereum.request({ method: "eth_chainId" });
  if (BigInt(currentChain) === BigInt(WALLET_ADD_CHAIN_PARAMS.chainId)) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: WALLET_ADD_CHAIN_PARAMS.chainId }],
    });
  } catch (error) {
    if (error?.code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [WALLET_ADD_CHAIN_PARAMS],
    });
  }
};

export default function V2Withdrawal() {
  const location = useLocation();
  const [pending, setPending] = useState(0n);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0n);
  const [minimumWithdraw, setMinimumWithdraw] = useState(10n ** 19n);
  const [loading, setLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState("");
  const [v1Overview, setV1Overview] = useState(null);
  const [v1Loading, setV1Loading] = useState(false);
  const [v1Message, setV1Message] = useState("");
  const [canWithdrawV1, setCanWithdrawV1] = useState(false);
  const [v1Withdrawing, setV1Withdrawing] = useState(false);

  const loadV1Overview = useCallback(async () => {
    try {
      setV1Loading(true);
      setV1Message("");
      const user = await getReadWalletAddress();
      if (!user || !ethers.isAddress(user)) throw new Error("Please connect your wallet.");

      const provider = new ethers.JsonRpcProvider(V1_MAINNET.rpcUrl, V1_MAINNET.chainId, { staticNetwork: true });
      const manager = new ethers.Contract(V1_MAINNET.packageManager, V1_MANAGER_ABI, provider);
      const referral = new ethers.Contract(V1_MAINNET.referralNetwork, V1_REFERRAL_ABI, provider);
      const v1User = await referral.users(user);
      if (!Boolean(v1User?.exists ?? v1User?.[8])) {
        setCanWithdrawV1(false);
        setV1Overview(null);
        return;
      }
      if (V1_WITHDRAWAL_HIDDEN_USERS.has(user.toLowerCase())) {
        setCanWithdrawV1(false);
        setV1Overview(null);
        return;
      }
      setCanWithdrawV1(true);
      const [
        directClaimable, directClaimed, selfClaimable, selfClaimed, levelClaimable,
        levelClaimed, powerClaimed, rewardClaimed, stakeHistoryLength,
        powerModuleAddress, rewardModuleAddress,
      ] = await Promise.all([
        manager.pendingDirectIncomeToken(user), manager.totalDirectIncomeToken(user),
        referral.getSelfRoiClaimableFor(user), manager.totalSelfRoiIncomeClaimed(user),
        referral.getTotalLevelRoiClaimableFor(user), manager.totalLevelRoiClaimed(user),
        manager.totalPowerIncomeClaimed(user), manager.totalRewardIncomeClaimed(user),
        manager.getStakeHistoryLength(user),
        manager.powerIncomeModule(), manager.rewardIncomeModule(),
      ]);
      const [powerClaimable, rewardClaimable] = await Promise.all([
        new ethers.Contract(powerModuleAddress, V1_RANK_MODULE_ABI, provider).rawClaimable(user),
        new ethers.Contract(rewardModuleAddress, V1_RANK_MODULE_ABI, provider).rawClaimable(user),
      ]);
      // V1's public incomeLimitBP is a legacy aggregate rate and does not
      // represent the tier cap of a $25/$100/$500/$1000 package. Sum the
      // contract's own per-package limits instead.
      const incomeLimit = (await Promise.all(
        Array.from({ length: Number(stakeHistoryLength) }, (_, index) => manager.getStakeIncomeStatus(user, index))
      )).reduce((total, status) => total + BigInt(status.incomeLimit ?? status[0] ?? 0n), 0n);
      setV1Overview({ directClaimable, directClaimed, selfClaimable, selfClaimed, levelClaimable, levelClaimed, powerClaimable, powerClaimed, rewardClaimable, rewardClaimed, incomeLimit, totalClaimable: BigInt(directClaimable) + BigInt(selfClaimable) + BigInt(levelClaimable) + BigInt(powerClaimable) + BigInt(rewardClaimable) });
    } catch (error) {
      setCanWithdrawV1(false);
      setV1Overview(null);
      setV1Message(error?.shortMessage || error?.message || "Could not load V1 withdrawal overview.");
    } finally {
      setV1Loading(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");
      const user = await getReadWalletAddress();
      if (!user || !ethers.isAddress(user)) throw new Error("Please connect your wallet.");
      if (!ethers.isAddress(V2LedgerAddress)) throw new Error("V2 ledger address is not configured.");

      const ledger = new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, createBscReadProvider());
      const [balance, minimum] = await Promise.all([
        ledger.balanceOf(user),
        ledger.minWithdrawAmount(),
      ]);
      const withdrawn = await ledger.getUserWithdrawHistoryLength(user)
        .then(async (length) => {
          const entries = await Promise.all(
            Array.from({ length: Number(length) }, (_, index) => ledger.getUserWithdrawHistoryAt(user, index)),
          );
          return entries.reduce((sum, item) => sum + (item.amount ?? item[0] ?? 0n), 0n);
        })
        .catch(() => 0n);

      setPending(balance);
      setMinimumWithdraw(minimum);
      setTotalWithdrawn(withdrawn);
    } catch (error) {
      setPending(0n);
      setMinimumWithdraw(10n ** 19n);
      setTotalWithdrawn(0n);
      setMessage(error?.shortMessage || error?.message || "Could not load V2 withdrawal data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadV1Overview();
  }, [load, loadV1Overview]);

  const refreshAll = async () => {
    await Promise.all([load(), loadV1Overview()]);
  };
  // Use distinct routes rather than URL hashes. NavLink only compares the
  // pathname for its active state, so hash-only links made both V1 and V2
  // appear selected and could leave mobile navigation on the wrong screen.
  // Keep the old V1 hash as a backwards-compatible deep link.
  const showV1 = canWithdrawV1 && (
    location.pathname === "/withdrawal/v1" || location.hash === "#withdraw-v1"
  );
  const showV2 = !showV1;
  const v1TotalClaimed = BigInt(v1Overview?.directClaimed ?? 0n)
    + BigInt(v1Overview?.selfClaimed ?? 0n)
    + BigInt(v1Overview?.levelClaimed ?? 0n)
    + BigInt(v1Overview?.powerClaimed ?? 0n)
    + BigInt(v1Overview?.rewardClaimed ?? 0n);
  const v1IncomeLimit = BigInt(v1Overview?.incomeLimit ?? 0n);
  const v1NinetyPercentLimit = (v1IncomeLimit * V1_WITHDRAWAL_CAP_BP) / 100n;
  const v1NinetyPercentReached = v1IncomeLimit > 0n && v1TotalClaimed >= v1NinetyPercentLimit;

  const withdraw = async () => {
    if (!window.ethereum) {
      setMessage("MetaMask or Trust Wallet is not available.");
      return;
    }
    if (pending <= 0n) {
      setMessage("No V2 income is pending for withdrawal.");
      return;
    }
    if (pending < minimumWithdraw) {
      setMessage(`Minimum V2 withdrawal is ${formatUsdt(minimumWithdraw)} USDT.`);
      return;
    }

    try {
      setWithdrawing(true);
      setMessage("Confirm V2 withdrawal in your wallet.");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureBscMainnet();
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const tx = await new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, signer).withdrawAll();
      await tx.wait();
      setMessage("V2 income withdrawn successfully.");
      await load();
    } catch (error) {
      setMessage(error?.shortMessage || error?.reason || error?.message || "V2 withdrawal failed.");
    } finally {
      setWithdrawing(false);
    }
  };

  const withdrawV1 = async () => {
    if (v1NinetyPercentReached) {
      setV1Message("Your 90% V1 income limit is reached. Buy a new package to withdraw the next amount.");
      return;
    }
    if (BigInt(v1Overview?.totalClaimable ?? 0n) < V1_MIN_WITHDRAWAL) {
      setV1Message("Minimum V1 withdrawal is 10 USDT.");
      return;
    }
    if (!window.ethereum) {
      setV1Message("MetaMask or Trust Wallet is not available.");
      return;
    }
    try {
      setV1Withdrawing(true);
      setV1Message("Confirm V1 withdrawal in your wallet.");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureBscMainnet();
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const v1Manager = new ethers.Contract(V1_MAINNET.packageManager, V1_MANAGER_ABI, signer);
      const tx = await v1Manager.withdrawIncome();
      await tx.wait();
      setV1Message("V1 income withdrawn successfully.");
      await loadV1Overview();
      window.dispatchEvent(new Event("btf:v2-data-changed"));
    } catch (error) {
      setV1Message(error?.shortMessage || error?.reason || error?.message || "V1 withdrawal failed.");
    } finally {
      setV1Withdrawing(false);
    }
  };

  return (
    <>
      {showV1 && <div id="withdraw-v1" className="table-card" style={{ marginTop: "24px" }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="mb-0">Withdraw V1</h2>
          <button className="btn btn-outline-primary" onClick={refreshAll} disabled={loading || v1Loading || withdrawing}>
            {v1Loading ? "Loading..." : "Refresh"}
          </button>
        </div>
        {v1Message ? <p className="team-loading">{v1Message}</p> : null}
        <div className="withdrawal-grid">
          <div className="withdrawal-card"><p className="withdrawal-card-title">Direct Claimable</p><h4 className="withdrawal-card-value">{formatUsdt(v1Overview?.directClaimable)} USDT</h4></div>
          <div className="withdrawal-card"><p className="withdrawal-card-title">Direct Claimed</p><h4 className="withdrawal-card-value">{formatUsdt(v1Overview?.directClaimed)} USDT</h4></div>
          <div className="withdrawal-card"><p className="withdrawal-card-title">Self ROI Claimable</p><h4 className="withdrawal-card-value">{formatUsdt(v1Overview?.selfClaimable)} USDT</h4></div>
          <div className="withdrawal-card"><p className="withdrawal-card-title">Self ROI Claimed</p><h4 className="withdrawal-card-value">{formatUsdt(v1Overview?.selfClaimed)} USDT</h4></div>
          <div className="withdrawal-card"><p className="withdrawal-card-title">Level ROI Claimable</p><h4 className="withdrawal-card-value">{formatUsdt(v1Overview?.levelClaimable)} USDT</h4></div>
          <div className="withdrawal-card"><p className="withdrawal-card-title">Level ROI Claimed</p><h4 className="withdrawal-card-value">{formatUsdt(v1Overview?.levelClaimed)} USDT</h4></div>
          <div className="withdrawal-card"><p className="withdrawal-card-title">Power Income Claimable</p><h4 className="withdrawal-card-value">{formatUsdt(v1Overview?.powerClaimable)} USDT</h4></div>
          <div className="withdrawal-card"><p className="withdrawal-card-title">Total Power Income Claimed</p><h4 className="withdrawal-card-value">{formatUsdt(v1Overview?.powerClaimed)} USDT</h4></div>
          <div className="withdrawal-card"><p className="withdrawal-card-title">Reward Claimable</p><h4 className="withdrawal-card-value">{formatUsdt(v1Overview?.rewardClaimable)} USDT</h4></div>
          <div className="withdrawal-card"><p className="withdrawal-card-title">Total Reward Income Claimed</p><h4 className="withdrawal-card-value">{formatUsdt(v1Overview?.rewardClaimed)} USDT</h4></div>
          <div className="withdrawal-card"><p className="withdrawal-card-title">Income Limit Token</p><h4 className="withdrawal-card-value">{formatUsdt(v1Overview?.incomeLimit)} USDT</h4></div>
          <div className="withdrawal-card"><p className="withdrawal-card-title">Total Claimable Income</p><h4 className="withdrawal-card-value">{formatUsdt(v1Overview?.totalClaimable)} USDT</h4></div>
        </div>
        <div className="withdraw-action-wrap">
          <button className="custom-button withdraw-btn" onClick={withdrawV1} disabled={v1Loading || v1Withdrawing || v1NinetyPercentReached || BigInt(v1Overview?.totalClaimable ?? 0n) < V1_MIN_WITHDRAWAL}>
            {v1Withdrawing ? "Withdrawing..." : "Withdraw V1"}
          </button>
          {v1NinetyPercentReached
            ? <p className="team-loading withdraw-status">Your 90% V1 income limit is reached. Buy a new package to withdraw the next amount.</p>
            : <p className="team-loading withdraw-status">Minimum V1 withdrawal: 10 USDT</p>}
        </div>
      </div>}

      {showV2 && <div id="withdraw-v2" className="table-card" style={{ marginTop: "24px" }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">V2 Withdrawal Total</h2>
        <button className="btn btn-outline-primary" onClick={refreshAll} disabled={loading || v1Loading || withdrawing}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      <div className="withdrawal-grid">
        <div className="withdrawal-card">
          <p className="withdrawal-card-title">V2 Pending Withdrawal</p>
          <h4 className="withdrawal-card-value">{formatUsdt(pending)} USDT</h4>
        </div>
        <div className="withdrawal-card">
          <p className="withdrawal-card-title">Total V2 Withdrawn</p>
          <h4 className="withdrawal-card-value">{formatUsdt(totalWithdrawn)} USDT</h4>
        </div>
        <div className="withdrawal-card">
          <p className="withdrawal-card-title">Minimum V2 Withdrawal</p>
          <h4 className="withdrawal-card-value">{formatUsdt(minimumWithdraw)} USDT</h4>
        </div>
      </div>
      <div className="withdraw-action-wrap">
        <button className="custom-button withdraw-btn" onClick={withdraw} disabled={withdrawing || pending < minimumWithdraw}>
          {withdrawing ? "Withdrawing..." : "Withdraw V2"}
        </button>
        {message ? <p className="team-loading withdraw-status">{message}</p> : null}
      </div>
      </div>}

    </>
  );
}
