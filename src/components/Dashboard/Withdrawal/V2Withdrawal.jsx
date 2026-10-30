import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { useLocation } from "react-router-dom";
import V2IncomeLedgerABI from "../../../blockchain/v2IncomeLedgerABI";
import LegacyV2IncomeLedgerABI from "../../../blockchain/legacyV2IncomeLedgerABI";
import V2PackageManagerABI from "../../../blockchain/v2PackageManagerABI";
import { LegacyV2LedgerAddress, PackageManagerAddress, ReferralNetworkAddress, SettlementTokenSymbol, V2DaoAddress, V2LedgerAddress, V3ActionsEnabled } from "../../../blockchain/address";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import { WALLET_ADD_CHAIN_PARAMS } from "../../../blockchain/bscMainnetConfig";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import { hasImportedLegacyPackage } from "../../../blockchain/legacyPackageImportState";
import { canAccessMigration } from "../../../blockchain/migrationAccess";

const V1_MIN_WITHDRAWAL = 10n ** 19n; // 10 USDT, token has 18 decimals
// Match the deployed Ledger's 1-token minimum, while respecting any higher
// on-chain value configured later.
const V2_UI_MIN_WITHDRAWAL = 10n ** 18n;
const V1_WITHDRAWAL_CAP_BP = 90n;
const WITHDRAWALS_PAUSED = !V3ActionsEnabled;
const MIGRATION_PAUSED_MESSAGE = "Withdrawal is temporarily unavailable while system migration is under construction. Please check back soon.";

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

const withdrawErrorMessage = (error) => {
  const revertData = error?.data ?? error?.info?.error?.data?.data;
  if (typeof revertData === "string" && revertData.startsWith("0x08c379a0")) {
    try {
      const reason = ethers.AbiCoder.defaultAbiCoder().decode(
        ["string"],
        `0x${revertData.slice(10)}`,
      )[0];
        if (reason === "NO_BALANCE") return "No V3 income is credited to this connected wallet.";
        if (reason === "MIN_WITHDRAW") return "Your credited V3 income is below the withdrawal minimum.";
        return `V3 withdrawal was rejected: ${reason}.`;
    } catch {
      // Fall through to the provider's normal message below.
    }
  }
  return error?.shortMessage || error?.reason || error?.message || "V3 withdrawal failed.";
};

const V1_MANAGER_ABI = [
  "function pendingDirectIncomeToken(address) view returns(uint256)",
  "function totalDirectIncomeToken(address) view returns(uint256)",
  "function totalSelfRoiIncomeClaimed(address) view returns(uint256)",
  "function totalLevelRoiClaimed(address) view returns(uint256)",
  "function totalPowerIncomeCredited(address) view returns(uint256)",
  "function totalPowerIncomeClaimed(address) view returns(uint256)",
  "function totalRewardIncomeClaimed(address) view returns(uint256)",
  "function totalPackageValue(address) view returns(uint256)",
  "function getStakeHistoryLength(address) view returns(uint256)",
  "function getStakeIncomeStatus(address,uint256) view returns(uint256 incomeLimit,uint256 usedIncome,uint256 remainingIncome,bool completed)",
  "function getStakeRoiInfo(address,uint256) view returns(uint256 principal,uint256 maxRoi,uint256 totalAccrued,uint256 claimed,uint256 claimable)",
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
const DAO_ABI = [
  "function proposalCount() view returns(uint256)",
  "function getProposal(uint256) view returns(address proposer,address target,bytes data,uint256 snapshotTime,uint256 endTime,uint256 eta,uint256 forVotes,uint256 againstVotes,uint256 abstainVotes,bool canceled,bool executed)",
  "function proposalQuorum(uint256) view returns(uint256)",
  "function hasVoted(uint256,address) view returns(bool)",
  "function castVote(uint256 proposalId,uint8 support)",
];
const REGISTRY_VOTING_ABI = [
  "function getVotingPowerAt(address user,uint256 snapshotTime) view returns(uint256)",
];
const DAO_VOTE_FOR = 1;
const DAO_VOTING_PROPOSAL_IDS = [23n];

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
  const [minimumWithdraw, setMinimumWithdraw] = useState(V2_UI_MIN_WITHDRAWAL);
  const [loading, setLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState("");
  const [v1Overview, setV1Overview] = useState(null);
  const [v1Loading, setV1Loading] = useState(false);
  const [v1Message, setV1Message] = useState("");
  const [canWithdrawV1, setCanWithdrawV1] = useState(false);
  const [hasActiveV2Package, setHasActiveV2Package] = useState(false);
  const [v1Withdrawing, setV1Withdrawing] = useState(false);
  const [daoVoting, setDaoVoting] = useState({ loading: false, visible: false, proposals: [], message: "" });
  const [votingProposalId, setVotingProposalId] = useState(null);
  const [selectedDaoProposalId, setSelectedDaoProposalId] = useState(null);

  const loadDaoVoting = useCallback(async () => {
    try {
      setDaoVoting((current) => ({ ...current, loading: true, message: "" }));
      const user = await getReadWalletAddress();
      if (!user || !ethers.isAddress(user) || !ethers.isAddress(V2DaoAddress)) {
        setDaoVoting({ loading: false, visible: false, proposals: [], message: "" });
        return;
      }

      const provider = createBscReadProvider();
      const dao = new ethers.Contract(V2DaoAddress, DAO_ABI, provider);
      const registry = new ethers.Contract(ReferralNetworkAddress, REGISTRY_VOTING_ABI, provider);
      const [proposalCount, latestBlock, isMigrationAuthority] = await Promise.all([
        dao.proposalCount(),
        provider.getBlock("latest"),
        canAccessMigration(user),
      ]);
      const now = BigInt(latestBlock?.timestamp ?? 0);
      // Governance currently has a small proposal history. Reading the most
      // recent 50 keeps this section fast even after the DAO has grown.
      const count = BigInt(proposalCount);
      const toRead = Number(count > 50n ? 50n : count);
      const proposalIds = Array.from(
        { length: toRead },
        (_, index) => count - BigInt(index),
      );
      const proposals = await Promise.all(proposalIds.map(async (proposalId) => {
        const proposal = await dao.getProposal(proposalId);
        const snapshotTime = BigInt(proposal[3]);
        const endTime = BigInt(proposal[4]);
        const eta = BigInt(proposal[5]);
        const canceled = Boolean(proposal[9]);
        const executed = Boolean(proposal[10]);
        // Show only proposals which are still in their voting window. Queued
        // and completed proposals cannot accept another vote.
        if (canceled || executed || eta !== 0n || now > endTime) return null;

        const [weight, hasVoted, quorum] = await Promise.all([
          registry.getVotingPowerAt(user, snapshotTime),
          dao.hasVoted(proposalId, user),
          dao.proposalQuorum(proposalId),
        ]);
        if (BigInt(weight) === 0n) return null;
        return {
          id: proposalId,
          endTime,
          forVotes: BigInt(proposal[6]),
          againstVotes: BigInt(proposal[7]),
          abstainVotes: BigInt(proposal[8]),
          quorum: BigInt(quorum),
          weight: BigInt(weight),
          hasVoted: Boolean(hasVoted),
        };
      }));
      const eligibleProposals = proposals.filter(Boolean);
      // Migration authority must be able to open this operational section as
      // well. It can cast a vote only when the DAO snapshot gives that wallet
      // voting weight; that remains enforced by the DAO contract itself.
      setDaoVoting({
        loading: false,
        visible: isMigrationAuthority || eligibleProposals.length > 0,
        proposals: eligibleProposals,
        message: "",
      });
    } catch (error) {
      setDaoVoting({
        loading: false,
        visible: false,
        proposals: [],
        message: error?.shortMessage || error?.message || "Could not load DAO voting data.",
      });
    }
  }, []);

  const loadV1Overview = useCallback(async () => {
    setCanWithdrawV1(false);
    setV1Overview(null);
    return;
    try {
      setV1Loading(true);
      setV1Message("");
      const user = await getReadWalletAddress();
      if (!user || !ethers.isAddress(user)) throw new Error("Please connect your wallet.");

      const provider = new ethers.JsonRpcProvider(V1_MAINNET.rpcUrl, V1_MAINNET.chainId, { staticNetwork: true });
      const manager = new ethers.Contract(V1_MAINNET.packageManager, V1_MANAGER_ABI, provider);
      const referral = new ethers.Contract(V1_MAINNET.referralNetwork, V1_REFERRAL_ABI, provider);
      const [v1User, v2CurrentPackage] = await Promise.all([
        referral.users(user),
        new ethers.Contract(PackageManagerAddress, V2PackageManagerABI, createBscReadProvider())
          .currentPackage(user)
          .catch(() => 0n),
      ]);
      setHasActiveV2Package(BigInt(v2CurrentPackage) > 0n);
      if (!Boolean(v1User?.exists ?? v1User?.[8])) {
        setCanWithdrawV1(false);
        setV1Overview(null);
        return;
      }
      // Only the V2-Self-ROI migration path permanently disables V1
      // withdrawals. Normal legacy package imports deliberately leave V1
      // withdrawal available and must not be hidden here.
      if (await hasImportedLegacyPackage(user)) {
        setCanWithdrawV1(false);
        setV1Overview(null);
        return;
      }
      const [
        directClaimable, directClaimed, selfClaimed, levelClaimable,
        levelClaimed, powerCredited, powerClaimed, rewardClaimed, stakeHistoryLength,
        powerModuleAddress, rewardModuleAddress,
      ] = await Promise.all([
        manager.pendingDirectIncomeToken(user), manager.totalDirectIncomeToken(user),
        manager.totalSelfRoiIncomeClaimed(user),
        referral.getTotalLevelRoiClaimableFor(user), manager.totalLevelRoiClaimed(user),
        manager.totalPowerIncomeCredited(user),
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
      const [stakeStatuses, stakeRois] = await Promise.all([
        Promise.all(
          Array.from({ length: Number(stakeHistoryLength) }, (_, index) => manager.getStakeIncomeStatus(user, index)),
        ),
        Promise.all(
          Array.from({ length: Number(stakeHistoryLength) }, (_, index) => manager.getStakeRoiInfo(user, index)),
        ),
      ]);
      // Read through PackageManager rather than ReferralNetwork's raw self
      // ROI helper. The Manager excludes stale ROI from completed packages,
      // exactly as `withdrawIncome()` does.
      const selfClaimable = stakeRois.reduce(
        (total, roi) => total + BigInt(roi.claimable ?? roi[4] ?? 0n), 0n,
      );
      const incomeLimit = stakeStatuses.reduce(
        (total, status) => total + BigInt(status.incomeLimit ?? status[0] ?? 0n), 0n,
      );
      // The V1 withdrawal route is only available while at least one V1
      // package is active. Completed V1-only accounts use the V2 route.
      setCanWithdrawV1(stakeStatuses.some((status) => !Boolean(status.completed ?? status[3])));
      setV1Overview({ directClaimable, directClaimed, selfClaimable, selfClaimed, levelClaimable, levelClaimed, powerClaimable, powerCredited, powerClaimed, rewardClaimable, rewardClaimed, incomeLimit, totalClaimable: BigInt(directClaimable) + BigInt(selfClaimable) + BigInt(levelClaimable) + BigInt(powerClaimable) + BigInt(rewardClaimable) });
    } catch (error) {
      setCanWithdrawV1(false);
      setHasActiveV2Package(false);
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
      if (!ethers.isAddress(V2LedgerAddress)) throw new Error("V3 ledger address is not configured.");

      const provider = createBscReadProvider();
      const ledger = new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, provider);
      const legacyLedger = new ethers.Contract(LegacyV2LedgerAddress, LegacyV2IncomeLedgerABI, provider);
      const [balance, minimum, v3Withdrawn, legacyV2Withdrawn] = await Promise.all([
        ledger.balanceOf(user),
        ledger.minWithdrawAmount(),
        ledger.getUserWithdrawHistoryLength(user)
        .then(async (length) => {
          const entries = await Promise.all(
            Array.from({ length: Number(length) }, (_, index) => ledger.getUserWithdrawHistoryAt(user, index)),
          );
          return entries.reduce((sum, item) => sum + (item.netAmount ?? item[2] ?? 0n), 0n);
        })
        .catch(() => 0n),
        legacyLedger.getUserWithdrawHistoryLength(user)
          .then(async (length) => {
            const entries = await Promise.all(
              Array.from({ length: Number(length) }, (_, index) => legacyLedger.getUserWithdrawHistoryAt(user, index)),
            );
            return entries.reduce((sum, item) => sum + BigInt(item.amount ?? item[0] ?? 0n), 0n);
          })
          .catch(() => 0n),
      ]);

      setPending(balance);
      setMinimumWithdraw(
        BigInt(minimum) > V2_UI_MIN_WITHDRAWAL
          ? BigInt(minimum)
          : V2_UI_MIN_WITHDRAWAL,
      );
      // V2's legacy ledger stores `(amount,timestamp)`, while V3 stores
      // `(gross,fee,net,timestamp)`. The user-facing history and this card
      // both represent the received/net amount, so the sum is consistent.
      setTotalWithdrawn(BigInt(legacyV2Withdrawn) + BigInt(v3Withdrawn));
    } catch (error) {
      setPending(0n);
      setMinimumWithdraw(V2_UI_MIN_WITHDRAWAL);
      setTotalWithdrawn(0n);
      setMessage(error?.shortMessage || error?.message || "Could not load V3 withdrawal data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadV1Overview();
    loadDaoVoting();
  }, [load, loadDaoVoting, loadV1Overview]);

  const refreshAll = async () => {
    await Promise.all([load(), loadV1Overview(), loadDaoVoting()]);
  };
  // Use distinct routes rather than URL hashes. NavLink only compares the
  // pathname for its active state, so hash-only links made both V1 and V2
  // appear selected and could leave mobile navigation on the wrong screen.
  // Keep the old V1 hash as a backwards-compatible deep link.
  const showV1 = canWithdrawV1 && (
    location.pathname === "/withdrawal/v1" || location.hash === "#withdraw-v1"
  );
  const showDaoOnly = location.pathname === "/dao-voting";
  const showV2 = !showV1 && !showDaoOnly;
  const availableDaoProposalIds = DAO_VOTING_PROPOSAL_IDS.filter((proposalId) =>
    daoVoting.proposals.some((proposal) => proposal.id === proposalId && !proposal.hasVoted),
  );
  const v1TotalClaimed = BigInt(v1Overview?.directClaimed ?? 0n)
    + BigInt(v1Overview?.selfClaimed ?? 0n)
    + BigInt(v1Overview?.levelClaimed ?? 0n)
    + BigInt(v1Overview?.powerCredited ?? 0n)
    + BigInt(v1Overview?.rewardClaimed ?? 0n);
  const v1IncomeLimit = BigInt(v1Overview?.incomeLimit ?? 0n);
  const v1NinetyPercentLimit = (v1IncomeLimit * V1_WITHDRAWAL_CAP_BP) / 100n;
  // A user with an active V2 package must not see the UI-only V1 90% block.
  // Keep the existing limit/message for users who have no active V2 package.
  const v1NinetyPercentReached = !hasActiveV2Package
    && v1IncomeLimit > 0n
    && v1TotalClaimed >= v1NinetyPercentLimit;
  const v1TotalClaimable = BigInt(v1Overview?.totalClaimable ?? 0n);

  const withdraw = async () => {
    if (WITHDRAWALS_PAUSED) {
      setMessage(MIGRATION_PAUSED_MESSAGE);
      return;
    }
    if (!window.ethereum) {
      setMessage("MetaMask or Trust Wallet is not available.");
      return;
    }
    if (pending <= 0n) {
      setMessage("No V3 income is pending for withdrawal.");
      return;
    }
    if (pending < minimumWithdraw) {
      setMessage(`Minimum withdrawal is ${formatUsdt(minimumWithdraw)} ${SettlementTokenSymbol}.`);
      return;
    }

    try {
      setWithdrawing(true);
      setMessage("Confirm V3 withdrawal in your wallet.");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureBscMainnet();
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const signerAddress = await signer.getAddress();
      const ledger = new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, signer);
      // Always use the wallet that is actually signing, rather than a cached
      // dashboard address. This prevents a stale/other-wallet balance from
      // displaying as withdrawable and then producing an opaque RPC error.
      const signerBalance = BigInt(await ledger.balanceOf(signerAddress));
      setPending(signerBalance);
      if (signerBalance === 0n) {
        setMessage("No V3 income is credited to this connected wallet.");
        return;
      }
      if (signerBalance < minimumWithdraw) {
        setMessage(`Minimum withdrawal is ${formatUsdt(minimumWithdraw)} ${SettlementTokenSymbol}.`);
        return;
      }
      // Surface a contract revert before opening the wallet's transaction
      // confirmation. In particular, this converts ethers' coalesce error
      // into the actual Ledger reason (NO_BALANCE/MIN_WITHDRAW).
      await ledger.withdrawAll.staticCall();
      const tx = await ledger.withdrawAll();
      await tx.wait();
      setMessage(`V3 income withdrawn successfully in ${SettlementTokenSymbol}.`);
      await load();
    } catch (error) {
      setMessage(withdrawErrorMessage(error));
    } finally {
      setWithdrawing(false);
    }
  };

  const withdrawV1 = async () => {
    if (WITHDRAWALS_PAUSED) {
      setV1Message(MIGRATION_PAUSED_MESSAGE);
      return;
    }
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

  const voteForProposal = async (proposalId) => {
    if (!window.ethereum) {
      return;
    }
    try {
      setVotingProposalId(proposalId);
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureBscMainnet();
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const dao = new ethers.Contract(V2DaoAddress, DAO_ABI, signer);
      const tx = await dao.castVote(proposalId, DAO_VOTE_FOR);
      await tx.wait();
      await loadDaoVoting();
      setSelectedDaoProposalId(null);
    } catch {
      // The wallet/provider displays the transaction rejection or contract
      // revert. Keep this compact voting form free of extra status cards.
    } finally {
      setVotingProposalId(null);
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
        {WITHDRAWALS_PAUSED ? <p className="team-loading withdraw-status">{MIGRATION_PAUSED_MESSAGE}</p> : null}
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
          <div className="withdrawal-card"><p className="withdrawal-card-title">Income Limit Withdraw</p><h4 className="withdrawal-card-value">{formatUsdt(v1TotalClaimed)} USDT</h4></div>
          <div className="withdrawal-card"><p className="withdrawal-card-title">Total Claimable Income</p><h4 className="withdrawal-card-value">{formatUsdt(v1TotalClaimable)} USDT</h4></div>
        </div>
        <div className="withdraw-action-wrap">
          <button className="custom-button withdraw-btn" onClick={withdrawV1} disabled={WITHDRAWALS_PAUSED || v1Loading || v1Withdrawing || v1NinetyPercentReached || BigInt(v1Overview?.totalClaimable ?? 0n) < V1_MIN_WITHDRAWAL}>
            {WITHDRAWALS_PAUSED ? "Withdrawal Paused" : v1Withdrawing ? "Withdrawing..." : "Withdraw V1"}
          </button>
          {v1NinetyPercentReached
            ? <p className="team-loading withdraw-status">Your 90% V1 income limit is reached. Buy a new package to withdraw the next amount.</p>
            : <p className="team-loading withdraw-status">Minimum V1 withdrawal: 10 USDT</p>}
        </div>
      </div>}

      {showV2 && <div id="withdraw-v2" className="table-card" style={{ marginTop: "24px" }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">Withdraw Total</h2>
        <button className="btn btn-outline-primary" onClick={refreshAll} disabled={loading || v1Loading || withdrawing}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {WITHDRAWALS_PAUSED ? <p className="team-loading withdraw-status">{MIGRATION_PAUSED_MESSAGE}</p> : null}
      <div className="withdrawal-grid">
        <div className="withdrawal-card">
          <p className="withdrawal-card-title">Pending Withdraw</p>
          <h4 className="withdrawal-card-value">{formatUsdt(pending)} USDT</h4>
        </div>
        <div className="withdrawal-card">
          <p className="withdrawal-card-title">Total Withdraw</p>
          <h4 className="withdrawal-card-value">{formatUsdt(totalWithdrawn)} USDT</h4>
        </div>
        <div className="withdrawal-card">
          <p className="withdrawal-card-title">Minimum Withdraw</p>
          <h4 className="withdrawal-card-value">{formatUsdt(minimumWithdraw)} {SettlementTokenSymbol}</h4>
        </div>
      </div>
      <div className="withdraw-action-wrap">
        <button className="custom-button withdraw-btn" onClick={withdraw} disabled={WITHDRAWALS_PAUSED || withdrawing || pending < minimumWithdraw}>
          {WITHDRAWALS_PAUSED ? "Withdrawal Paused" : withdrawing ? "Withdrawing..." : "Withdraw V3"}
        </button>
        {message ? <p className="team-loading withdraw-status">{message}</p> : null}
      </div>
      </div>}

      {(daoVoting.visible || showDaoOnly) && availableDaoProposalIds.length > 0 && <div id="dao-voting" className="table-card" style={{ marginTop: "24px" }}>
        <p className="withdrawal-card-title mb-3">Proposal ID</p>
        <div className="dao-proposal-button-grid">
          {availableDaoProposalIds.map((proposalId) => <button
            key={proposalId.toString()}
            type="button"
            className={`dao-proposal-button ${selectedDaoProposalId === proposalId ? "selected" : ""}`}
            onClick={() => setSelectedDaoProposalId(proposalId)}
            disabled={votingProposalId !== null}
          >
            {proposalId.toString()}
          </button>)}
        </div>
        <div className="dao-proposal-vote-wrap">
          <button
            type="button"
            className="dao-proposal-vote-button"
            onClick={() => voteForProposal(selectedDaoProposalId)}
            disabled={selectedDaoProposalId === null || votingProposalId !== null}
          >
            {votingProposalId !== null ? "Voting..." : "Vote"}
          </button>
        </div>
      </div>}

    </>
  );
}
