import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { useLocation } from "react-router-dom";
import V2IncomeLedgerABI from "../../../blockchain/v2IncomeLedgerABI";
import { V2LedgerAddress } from "../../../blockchain/address";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import { WALLET_ADD_CHAIN_PARAMS } from "../../../blockchain/bscMainnetConfig";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";

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
  "function incomeWalletToken(address) view returns(uint256)",
  "function incomeLimitBP() view returns(uint256)",
  "function powerIncomeModule() view returns(address)",
  "function rewardIncomeModule() view returns(address)",
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
  const [hasV1Registration, setHasV1Registration] = useState(false);

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
        setHasV1Registration(false);
        setV1Overview(null);
        return;
      }
      setHasV1Registration(true);
      const [
        directClaimable, directClaimed, selfClaimable, selfClaimed, levelClaimable,
        levelClaimed, powerClaimed, rewardClaimed, packageValue, remainingUsdt,
        incomeLimitBP, powerModuleAddress, rewardModuleAddress,
      ] = await Promise.all([
        manager.pendingDirectIncomeToken(user), manager.totalDirectIncomeToken(user),
        referral.getSelfRoiClaimableFor(user), manager.totalSelfRoiIncomeClaimed(user),
        referral.getTotalLevelRoiClaimableFor(user), manager.totalLevelRoiClaimed(user),
        manager.totalPowerIncomeClaimed(user), manager.totalRewardIncomeClaimed(user),
        manager.totalPackageValue(user), manager.incomeWalletToken(user), manager.incomeLimitBP(),
        manager.powerIncomeModule(), manager.rewardIncomeModule(),
      ]);
      const [powerClaimable, rewardClaimable] = await Promise.all([
        new ethers.Contract(powerModuleAddress, V1_RANK_MODULE_ABI, provider).rawClaimable(user),
        new ethers.Contract(rewardModuleAddress, V1_RANK_MODULE_ABI, provider).rawClaimable(user),
      ]);
      const incomeLimit = (BigInt(packageValue) * BigInt(incomeLimitBP)) / 10_000n;
      setV1Overview({ directClaimable, directClaimed, selfClaimable, selfClaimed, levelClaimable, levelClaimed, powerClaimable, powerClaimed, rewardClaimable, rewardClaimed, incomeLimit, remainingUsdt, totalClaimable: BigInt(directClaimable) + BigInt(selfClaimable) + BigInt(levelClaimable) + BigInt(powerClaimable) + BigInt(rewardClaimable) });
    } catch (error) {
      setHasV1Registration(false);
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
  const showV1 = hasV1Registration && location.hash === "#withdraw-v1";
  const showV2 = location.hash !== "#withdraw-v1";

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
          <div className="withdrawal-card"><p className="withdrawal-card-title">Remaining USDT</p><h4 className="withdrawal-card-value">{formatUsdt(v1Overview?.remainingUsdt)} USDT</h4></div>
          <div className="withdrawal-card"><p className="withdrawal-card-title">Total Claimable Income</p><h4 className="withdrawal-card-value">{formatUsdt(v1Overview?.totalClaimable)} USDT</h4></div>
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
