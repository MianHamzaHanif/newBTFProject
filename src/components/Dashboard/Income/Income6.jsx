import { TableCell } from "@mui/material";
import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2PackageManagerABI from "../../../blockchain/v2PackageManagerABI";
import V2ReferralRegistryABI from "../../../blockchain/v2ReferralRegistryABI";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import { PackageManagerAddress, ReferralNetworkAddress, V2LegacyRankCheckpointAddress } from "../../../blockchain/address";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";

const E18 = 10n ** 18n;
const rewardAmounts = [0n, 250n, 500n, 1250n, 2500n, 5000n, 5000n, 5000n, 5000n, 5000n, 5000n, 5000n, 5000n];
const rewardInstallments = [0n, 1n, 1n, 1n, 1n, 1n, 2n, 4n, 8n, 16n, 32n, 64n, 128n];
const ROI_DAY_SECONDS = 120n;
const RANK_CHECKPOINT_READ_ABI = [
  "function getRewardSchedule(address user,uint256 index) view returns(uint256 originalAchievedAt,uint256 nextInstallmentAt,uint256 paidInstallments,uint256 releasedAfterCutover,uint256 unpaidAmount,uint256 level,bool set)",
  "function previewRewardClaimable(address user,uint256 index) view returns(uint256 amount)"
];
const V1_REWARD_MANAGER_ABI = [
  "function rewardAchievedAt(address user,uint256 index) view returns(uint256)",
  "function rewardClaimedAmountByIndex(address user,uint256 index) view returns(uint256)",
];

const formatEther4 = (value) => {
  try {
    const [whole, fraction = ""] = ethers.formatEther(value ?? 0n).split(".");
    return `${whole}.${(fraction + "0000").slice(0, 4)}`;
  } catch { return "0.0000"; }
};

const formatTimestamp = (value) => {
  const seconds = Number(value ?? 0n);
  return seconds ? new Date(seconds * 1000).toLocaleString() : "-";
};

const releasedCountNow = (index, achievedAt, roiDaySeconds) => {
  if (!achievedAt) return 0n;
  const now = BigInt(Math.floor(Date.now() / 1000));
  let released = 1n;
  if (now >= achievedAt) released = ((now - achievedAt) / (30n * roiDaySeconds)) + 1n;
  return released > rewardInstallments[index] ? rewardInstallments[index] : released;
};

export const Income6 = () => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [cards, setCards] = useState({ achievedRewardCount: "0", latestRewardLevel: "0", latestAchievedAt: "-", nextRewardIndex: "R1", totalClaimedAmount: "0.0000", totalClaimableAmount: "0.0000", rewardIncomeClaimable: "0.0000", nextClaimableIndex: "-", unlockedCount: "0" });
  const columns = [
    { id: "sno", label: "S. No", sortable: true }, { id: "rewardLevel", label: "Reward Level", sortable: true },
    { id: "achievedAt", label: "Achieved At", sortable: true }, { id: "totalRewardAmount", label: "Total Reward", sortable: true },
    { id: "monthlyRewardAmount", label: "Per Installment", sortable: true }, { id: "installmentCount", label: "Released / Total", sortable: true },
    { id: "releasedAmount", label: "Released Value", sortable: true }, { id: "claimedCycles", label: "Claimed Cycles", sortable: true }, { id: "claimedAmount", label: "Already Claimed", sortable: true },
    { id: "claimableAmount", label: "Currently Claimable", sortable: true }, { id: "remainingAmount", label: "Remaining Schedule", sortable: true },
    { id: "nextPayoutAt", label: "Next Payout At", sortable: true }, { id: "lastClaimAt", label: "Last Claim Time", sortable: true },
  ];

  useEffect(() => {
    const load = async () => {
      if (!window.ethereum || !PackageManagerAddress || !ReferralNetworkAddress) return;
      try {
        setIsLoading(true);
        const user = await getReadWalletAddress();
        if (!user || !ethers.isAddress(user)) return;
        const provider = createBscReadProvider();
        const manager = new ethers.Contract(PackageManagerAddress, V2PackageManagerABI, provider);
        const incomeLens = new ethers.Contract(await manager.incomeReadyLens(), V2PackageManagerABI, provider);
        const registry = new ethers.Contract(ReferralNetworkAddress, V2ReferralRegistryABI, provider);
        const checkpoint = new ethers.Contract(V2LegacyRankCheckpointAddress, RANK_CHECKPOINT_READ_ABI, provider);
        const [countRaw, rewardReady, roiDayRaw, legacyBaseline, legacyBaselineCount] = await Promise.all([
          registry.getAchievedRewardCount(user), incomeLens.getIncomeReady(user, 4), manager.ROI_DAY(),
          manager.legacyRankBaselineSet(user), manager.legacyRewardBaselineCount(user),
        ]);
        const roiDaySeconds = BigInt(roiDayRaw || ROI_DAY_SECONDS);
        const count = Number(countRaw);
        let claimedTotal = 0n;
        let unlockedTotal = 0n;
        let legacyReadyTotal = 0n;
        const legacyRows = [];
        const v2Rows = [];
        for (let index = 1; index <= count; index += 1) {
          const [achievedAt, releasedRaw, pending, carried, claimed, claimedCycles, lastClaimAt] = await Promise.all([
            registry.rewardAchievedAt(user, index), manager.rewardReleasedCount(user, index), manager.pendingRewardIncome(user, index), manager.carriedRewardIncome(user, index),
            manager.rewardIncomeClaimedByIndex(user, index), manager.rewardInstallmentsClaimedCount(user, index), manager.rewardLastClaimAt(user, index),
          ]);
          let legacySchedule = { set: false, paidInstallments: 0n, originalAchievedAt: 0n, nextInstallmentAt: 0n };
          let legacyPreview = 0n;
          try {
            [legacySchedule, legacyPreview] = await Promise.all([
              checkpoint.getRewardSchedule(user, index), checkpoint.previewRewardClaimable(user, index),
            ]);
          } catch {
            // Old checkpoints without this optional read method must not
            // prevent normal V2 Reward details from rendering.
          }
          const isLegacyBaseline = legacyBaseline && BigInt(index) <= BigInt(legacyBaselineCount);
          const legacyScheduleSet = Boolean(legacySchedule.set);
          const achievedAtValue = isLegacyBaseline && legacyScheduleSet
            ? BigInt(legacySchedule.originalAchievedAt)
            : BigInt(achievedAt);
          let released;
          let calculated;
          let nextPayoutAt;
          if (isLegacyBaseline) {
            // Baseline ranks must never be recomputed as a new V2 schedule.
            // The checkpoint is the single source for their V1 remainder.
            const legacyReady = BigInt(legacyPreview);
            const paid = legacyScheduleSet ? BigInt(legacySchedule.paidInstallments) : rewardInstallments[index];
            released = paid + (legacyReady / (rewardAmounts[index] * E18));
            if (released > rewardInstallments[index]) released = rewardInstallments[index];
            calculated = legacyReady;
            nextPayoutAt = legacyScheduleSet && released < rewardInstallments[index]
              ? BigInt(legacySchedule.nextInstallmentAt)
              : 0n;
            legacyReadyTotal += legacyReady;
          } else {
            released = releasedCountNow(index, achievedAtValue, roiDaySeconds);
            const alreadyReleased = BigInt(releasedRaw);
            calculated = released > alreadyReleased ? (released - alreadyReleased) * rewardAmounts[index] * E18 : 0n;
            nextPayoutAt = released < rewardInstallments[index]
              ? achievedAtValue + (released * 30n * roiDaySeconds)
              : 0n;
          }
          const claimable = BigInt(pending) + BigInt(carried) + calculated;
          const totalReward = rewardAmounts[index] * rewardInstallments[index] * E18;
          const releasedAmount = released * rewardAmounts[index] * E18;
          const remainingAmount = totalReward > releasedAmount ? totalReward - releasedAmount : 0n;
          const historicClaimed = isLegacyBaseline && legacyScheduleSet
            ? BigInt(claimed) + BigInt(legacySchedule.paidInstallments) * rewardAmounts[index] * E18
            : BigInt(claimed);
          claimedTotal += historicClaimed;
          unlockedTotal += released;
          // A checkpoint schedule is paid by V2 after migration, even when
          // its original achievement came from V1.
          const row = { source: isLegacyBaseline ? "V2 (Migrated)" : "V2 (New)", rewardLevel: `R${index}`, achievedAt: formatTimestamp(achievedAtValue), totalRewardAmount: formatEther4(totalReward), monthlyRewardAmount: formatEther4(rewardAmounts[index] * E18), installmentCount: `${released}/${rewardInstallments[index]}`, releasedAmount: formatEther4(releasedAmount), claimedCycles: isLegacyBaseline && legacyScheduleSet ? Number(legacySchedule.paidInstallments) : Number(claimedCycles), claimedAmount: formatEther4(historicClaimed), claimableAmount: formatEther4(claimable), remainingAmount: formatEther4(remainingAmount), nextPayoutAt: formatTimestamp(nextPayoutAt), lastClaimAt: formatTimestamp(lastClaimAt) };
          if (isLegacyBaseline) legacyRows.push(row);
          else v2Rows.push(row);
        }
        // Read V1 independently. A V2 R1/R2 row wins over the same V1 rank,
        // so a migrated user never sees the same reward rank twice.
        const v2RewardIndexes = new Set(Array.from({ length: count }, (_, offset) => offset + 1));
        const v1Manager = new ethers.Contract(V1_MAINNET.packageManager, V1_REWARD_MANAGER_ABI, provider);
        const v1Snapshots = await Promise.all(Array.from({ length: 12 }, async (_, offset) => {
          const index = offset + 1;
          const [achievedAt, claimed] = await Promise.all([
            v1Manager.rewardAchievedAt(user, index),
            v1Manager.rewardClaimedAmountByIndex(user, index),
          ]);
          return { index, achievedAt: BigInt(achievedAt), claimed: BigInt(claimed) };
        }));
        let v1ReadyTotal = 0n;
        let v1ClaimedTotal = 0n;
        const v1Rows = v1Snapshots
          .filter((item) => item.achievedAt > 0n && !v2RewardIndexes.has(item.index))
          .map((item) => {
            const released = releasedCountNow(item.index, item.achievedAt, roiDaySeconds);
            const installmentAmount = rewardAmounts[item.index] * E18;
            const totalReward = installmentAmount * rewardInstallments[item.index];
            const releasedAmount = installmentAmount * released;
            const claimable = releasedAmount > item.claimed ? releasedAmount - item.claimed : 0n;
            const remaining = totalReward > releasedAmount ? totalReward - releasedAmount : 0n;
            const claimedCycles = installmentAmount ? item.claimed / installmentAmount : 0n;
            const nextPayoutAt = released < rewardInstallments[item.index]
              ? item.achievedAt + (released * 30n * roiDaySeconds)
              : 0n;
            v1ReadyTotal += claimable;
            v1ClaimedTotal += item.claimed;
            return { source: "V1 (Legacy)", rewardLevel: `R${item.index}`, achievedAt: formatTimestamp(item.achievedAt), totalRewardAmount: formatEther4(totalReward), monthlyRewardAmount: formatEther4(installmentAmount), installmentCount: `${released}/${rewardInstallments[item.index]}`, releasedAmount: formatEther4(releasedAmount), claimedCycles: Number(claimedCycles), claimedAmount: formatEther4(item.claimed), claimableAmount: formatEther4(claimable), remainingAmount: formatEther4(remaining), nextPayoutAt: formatTimestamp(nextPayoutAt), lastClaimAt: "V1 record" };
          });
        setRows([...v1Rows, ...legacyRows, ...v2Rows].map((row, index) => ({ ...row, sno: index + 1 })));
        const latestAt = count ? await registry.rewardAchievedAt(user, count) : 0n;
        const highestV1Index = v1Snapshots.reduce((highest, item) => item.achievedAt > 0n ? item.index : highest, 0);
        const displayCount = count || highestV1Index;
        const totalReady = BigInt(rewardReady) + legacyReadyTotal + v1ReadyTotal;
        setCards({ achievedRewardCount: String(displayCount), latestRewardLevel: displayCount ? `R${displayCount}` : "0", latestAchievedAt: formatTimestamp(latestAt || v1Snapshots[highestV1Index - 1]?.achievedAt), nextRewardIndex: displayCount < 12 ? `R${displayCount + 1}` : "Completed", totalClaimedAmount: formatEther4(claimedTotal + v1ClaimedTotal), totalClaimableAmount: formatEther4(totalReady), rewardIncomeClaimable: formatEther4(totalReady), nextClaimableIndex: displayCount ? "R1" : "-", unlockedCount: String(unlockedTotal) });
      } catch {
        setRows([]);
      } finally { setIsLoading(false); }
    };
    load();
  }, [refreshKey]);

  const topCards = useMemo(() => <>
    <div className="withdrawal-grid" style={{ marginTop: "14px" }}>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Achieved Reward Count</p><h4 className="withdrawal-card-value">{cards.achievedRewardCount}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Latest Reward Level</p><h4 className="withdrawal-card-value">{cards.latestRewardLevel}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Latest Achieved At</p><h4 className="withdrawal-card-value" style={{ fontSize: "19px", whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: "1.35" }}>{cards.latestAchievedAt}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Reward Income Claimable</p><h4 className="withdrawal-card-value">{cards.rewardIncomeClaimable}</h4></div>
    </div>
    <div className="withdrawal-grid" style={{ marginTop: "12px" }}>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Next Reward Level</p><h4 className="withdrawal-card-value">{cards.nextRewardIndex}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Total Claimed Amount</p><h4 className="withdrawal-card-value">{cards.totalClaimedAmount}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Total Claimable Amount</p><h4 className="withdrawal-card-value">{cards.totalClaimableAmount}</h4></div>
      <div className="withdrawal-card"><p className="withdrawal-card-title">Next Claimable: {cards.nextClaimableIndex} | Unlocked: {cards.unlockedCount}</p><h4 className="withdrawal-card-value">{cards.rewardIncomeClaimable}</h4></div>
    </div>
  </>, [cards]);

  return <div className="page-container"><div className="d-flex justify-content-between align-items-center mb-3"><h1 className="mb-0">Reward Details</h1><button className="btn btn-primary" onClick={() => setRefreshKey((key) => key + 1)} disabled={isLoading}>{isLoading ? "Loading..." : "Refresh"}</button></div><div className="table-wrapper"><div className="table-card ">{topCards}
    {isLoading && <p className="team-loading">Loading reward details...</p>}
    <div style={{ marginTop: "24px" }}><CustomTable columns={columns} rows={rows} renderRow={(row) => <>
      <TableCell align="center">{row.sno}</TableCell><TableCell align="center">{row.rewardLevel}</TableCell><TableCell align="center" className="team-time-cell">{row.achievedAt}</TableCell><TableCell align="center">{row.totalRewardAmount}</TableCell><TableCell align="center">{row.monthlyRewardAmount}</TableCell><TableCell align="center">{row.installmentCount}</TableCell><TableCell align="center">{row.releasedAmount}</TableCell><TableCell align="center">{row.claimedCycles}</TableCell><TableCell align="center">{row.claimedAmount}</TableCell><TableCell align="center">{row.claimableAmount}</TableCell><TableCell align="center">{row.remainingAmount}</TableCell><TableCell align="center" className="team-time-cell">{row.nextPayoutAt}</TableCell><TableCell align="center" className="team-time-cell">{row.lastClaimAt}</TableCell>
    </>} /></div>
  </div></div></div>;
};

export default Income6;
