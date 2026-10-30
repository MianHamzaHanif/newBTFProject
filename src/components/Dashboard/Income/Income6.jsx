import { TableCell } from "@mui/material";
import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2PackageManagerABI from "../../../blockchain/v2PackageManagerABI";
import V2ReferralRegistryABI from "../../../blockchain/v2ReferralRegistryABI";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import { IncomeReadyLensAddress, LegacyV2PackageManagerAddress, LegacyV2RegistryAddress, PackageManagerAddress, ReferralNetworkAddress, V2LegacyRankCheckpointAddress } from "../../../blockchain/address";
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
        const incomeLens = new ethers.Contract(IncomeReadyLensAddress, V2PackageManagerABI, provider);
        const registry = new ethers.Contract(ReferralNetworkAddress, V2ReferralRegistryABI, provider);
        const checkpoint = new ethers.Contract(V2LegacyRankCheckpointAddress, RANK_CHECKPOINT_READ_ABI, provider);
        const [countRaw, rewardReady, roiDayRaw, legacyBaseline, legacyBaselineCount] = await Promise.all([
          registry.getAchievedRewardCount(user).catch(() => 0n),
          incomeLens.getIncomeReady(user, 4).catch(() => 0n),
          // Some already-deployed V3 Manager versions predate these optional
          // getters. Their absence must never erase V1/V2 Reward history.
          manager.ROI_DAY().catch(() => ROI_DAY_SECONDS),
          manager.legacyRankBaselineSet(user).catch(() => false),
          manager.legacyRewardBaselineCount(user).catch(() => 0n),
        ]);
        const roiDaySeconds = BigInt(roiDayRaw || ROI_DAY_SECONDS);
        const count = Number(countRaw);
        let claimedTotal = 0n;
        let unlockedTotal = 0n;
        let legacyReadyTotal = 0n;
        const migratedRows = [];
        const v2Rows = [];
        for (let index = 1; index <= count; index += 1) {
          const [achievedAt, releasedRaw, pending, carried, claimed, claimedCycles, lastClaimAt] = await Promise.all([
            registry.rewardAchievedAt(user, index).catch(() => 0n),
            manager.rewardReleasedCount(user, index).catch(() => 0n),
            manager.pendingRewardIncome(user, index).catch(() => 0n),
            manager.carriedRewardIncome(user, index).catch(() => 0n),
            manager.rewardIncomeClaimedByIndex(user, index).catch(() => 0n),
            manager.rewardInstallmentsClaimedCount(user, index).catch(() => 0n),
            manager.rewardLastClaimAt(user, index).catch(() => 0n),
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
          const hasNativeV3State = !isLegacyBaseline && (
            BigInt(releasedRaw) > 0n || BigInt(pending) > 0n || BigInt(carried) > 0n ||
            BigInt(claimed) > 0n || BigInt(claimedCycles) > 0n
          );
          const row = { index, hasNativeV3State, rewardLevel: `R${index}`, achievedAt: formatTimestamp(achievedAtValue), totalRewardAmount: formatEther4(totalReward), monthlyRewardAmount: formatEther4(rewardAmounts[index] * E18), installmentCount: `${released}/${rewardInstallments[index]}`, releasedAmount: formatEther4(releasedAmount), claimedCycles: isLegacyBaseline && legacyScheduleSet ? Number(legacySchedule.paidInstallments) : Number(claimedCycles), claimedAmount: formatEther4(historicClaimed), claimableAmount: formatEther4(claimable), remainingAmount: formatEther4(remainingAmount), nextPayoutAt: formatTimestamp(nextPayoutAt), lastClaimAt: formatTimestamp(lastClaimAt) };
          if (isLegacyBaseline) migratedRows.push(row);
          else v2Rows.push(row);
        }
        // Read historical V2 directly. V3 snapshot records often contain a
        // rank but no historical paid cycles, so the old V2 row remains the
        // authoritative display until V3 has its own payment state.
        const legacyManager = new ethers.Contract(LegacyV2PackageManagerAddress, V2PackageManagerABI, provider);
        const legacyRegistry = new ethers.Contract(LegacyV2RegistryAddress, V2ReferralRegistryABI, provider);
        const legacyCount = Number(await legacyRegistry.getAchievedRewardCount(user).catch(() => 0n));
        const legacyV2Rows = await Promise.all(Array.from({ length: legacyCount }, async (_, offset) => {
          const index = offset + 1;
          const [achievedAt, released, pending, carried, claimed, claimedCycles, lastClaimAt] = await Promise.all([
            legacyRegistry.rewardAchievedAt(user, index).catch(() => 0n),
            legacyManager.rewardReleasedCount(user, index).catch(() => 0n),
            legacyManager.pendingRewardIncome(user, index).catch(() => 0n),
            legacyManager.carriedRewardIncome(user, index).catch(() => 0n),
            legacyManager.rewardIncomeClaimedByIndex(user, index).catch(() => 0n),
            legacyManager.rewardInstallmentsClaimedCount(user, index).catch(() => 0n),
            legacyManager.rewardLastClaimAt(user, index).catch(() => 0n),
          ]);
          const totalReward = rewardAmounts[index] * rewardInstallments[index] * E18;
          const releasedCount = BigInt(released);
          const releasedAmount = releasedCount * rewardAmounts[index] * E18;
          const remaining = totalReward > releasedAmount ? totalReward - releasedAmount : 0n;
          // A V2 rank may be only a migration snapshot from V1.  It must
          // not replace the V1 history unless V2 itself has paid, released,
          // or carries reward state for this rank.
          const hasNativeV2State = BigInt(released) > 0n || BigInt(pending) > 0n ||
            BigInt(carried) > 0n || BigInt(claimed) > 0n || BigInt(claimedCycles) > 0n;
          return { index, hasNativeV2State, rewardLevel: `R${index}`, achievedAt: formatTimestamp(achievedAt), totalRewardAmount: formatEther4(totalReward), monthlyRewardAmount: formatEther4(rewardAmounts[index] * E18), installmentCount: `${releasedCount}/${rewardInstallments[index]}`, releasedAmount: formatEther4(releasedAmount), claimedCycles: Number(claimedCycles), claimedAmount: formatEther4(claimed), claimableAmount: formatEther4(BigInt(pending) + BigInt(carried)), remainingAmount: formatEther4(remaining), nextPayoutAt: "-", lastClaimAt: formatTimestamp(lastClaimAt) };
        }));
        const legacyV2ByIndex = new Map(legacyV2Rows.map((row) => [row.index, row]));
        const v3ByIndex = new Map([...migratedRows, ...v2Rows].map((row) => [row.index, row]));
        // Read V1 independently. A V3 row with actual V3 activity wins. If
        // V3 only contains a migrated rank snapshot, show paid V2 history;
        // V1 is used only if neither newer source has that rank.
        const newerIndexes = new Set([
          ...legacyV2Rows.filter((row) => row.hasNativeV2State).map((row) => row.index),
          ...[...v3ByIndex.values()].filter((row) => row.hasNativeV3State).map((row) => row.index),
        ]);
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
          .filter((item) => item.achievedAt > 0n && !newerIndexes.has(item.index))
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
            return { index: item.index, rewardLevel: `R${item.index}`, achievedAt: formatTimestamp(item.achievedAt), totalRewardAmount: formatEther4(totalReward), monthlyRewardAmount: formatEther4(installmentAmount), installmentCount: `${released}/${rewardInstallments[item.index]}`, releasedAmount: formatEther4(releasedAmount), claimedCycles: Number(claimedCycles), claimedAmount: formatEther4(item.claimed), claimableAmount: formatEther4(claimable), remainingAmount: formatEther4(remaining), nextPayoutAt: formatTimestamp(nextPayoutAt), lastClaimAt: "V1 record" };
          });
        const displayRows = Array.from(new Set([
          ...v1Rows.map((row) => row.index),
          ...legacyV2Rows.map((row) => row.index),
          ...[...v3ByIndex.values()].map((row) => row.index),
        ]))
          .map((index) => {
            const v3 = v3ByIndex.get(index);
            const v2 = legacyV2ByIndex.get(index);
            const v1 = v1Rows.find((row) => row.index === index);
            // Only native state takes priority. Migration-only V2/V3 rows
            // are fallbacks and cannot hide a real legacy V1 reward record.
            if (v3?.hasNativeV3State) return v3;
            if (v2?.hasNativeV2State) return v2;
            return v1 ?? v3 ?? v2;
          })
          .filter(Boolean)
          .sort((a, b) => Number(b.achievedAt !== "-") - Number(a.achievedAt !== "-") || b.index - a.index);
        const visibleClaimed = displayRows.reduce((total, row) => total + ethers.parseEther(String(row.claimedAmount || "0")), 0n);
        setRows(displayRows.map((row, index) => ({ ...row, sno: index + 1 })));
        const latestAt = count ? await registry.rewardAchievedAt(user, count) : 0n;
        const highestV1Index = v1Snapshots.reduce((highest, item) => item.achievedAt > 0n ? item.index : highest, 0);
        const displayCount = count || highestV1Index;
        // Ready income belongs to the active V3 contract; old V1/V2 values
        // are displayed in history and must not be re-added to a claimable
        // V3 balance.
        const totalReady = BigInt(rewardReady);
        setCards({ achievedRewardCount: String(displayCount), latestRewardLevel: displayCount ? `R${displayCount}` : "0", latestAchievedAt: formatTimestamp(latestAt || v1Snapshots[highestV1Index - 1]?.achievedAt), nextRewardIndex: displayCount < 12 ? `R${displayCount + 1}` : "Completed", totalClaimedAmount: formatEther4(visibleClaimed), totalClaimableAmount: formatEther4(totalReady), rewardIncomeClaimable: formatEther4(totalReady), nextClaimableIndex: displayCount ? "R1" : "-", unlockedCount: String(unlockedTotal) });
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
