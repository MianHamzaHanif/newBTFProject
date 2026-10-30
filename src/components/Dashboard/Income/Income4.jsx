import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { TableCell } from "@mui/material";
import CustomTable from "../CommonComponents/CustomTable";
import V2PackageManagerABI from "../../../blockchain/v2PackageManagerABI";
import V2ReferralRegistryABI from "../../../blockchain/v2ReferralRegistryABI";
import V2IncomeLedgerABI from "../../../blockchain/v2IncomeLedgerABI";
import { IncomeReadyLensAddress, LegacyV2PackageManagerAddress, LegacyV2RegistryAddress, PackageManagerAddress, ReferralNetworkAddress, V2LedgerAddress, V2LegacyRankCheckpointAddress } from "../../../blockchain/address";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import {
  createBscReadProvider,
  getReadWalletAddress,
} from "../../../blockchain/readProvider";
import "../styles/style.css";

const formatUsdt = (value) => {
  try {
    const amount = ethers.formatEther(value ?? 0n);
    const [whole, decimals = ""] = amount.split(".");
    return `${whole}.${(decimals + "0000").slice(0, 4)}`;
  } catch {
    return "0.0000";
  }
};

const formatTime = (value) => {
  const timestamp = Number(value ?? 0n);
  if (!timestamp) return "-";
  return new Date(timestamp * 1000).toLocaleString();
};
const RANK_CHECKPOINT_READ_ABI = [
  "function getPowerSchedule(address) view returns(uint256 originalAchievedAt,uint256 nextInstallmentAt,uint256 paidInstallments,uint256 releasedAfterCutover,uint256 unpaidAmount,uint256 level,bool set)",
  "function previewPowerClaimable(address user) view returns(uint256 level,uint256 amount)"
];
const V1_POWER_MANAGER_ABI = [
  "function powerIncomeModule() view returns(address)",
  "function totalPowerIncomeClaimed(address) view returns(uint256)",
  "function powerLastClaimAt(address) view returns(uint256)",
  "function powerNextPayoutAt(address) view returns(uint256)",
  "function oneDay() view returns(uint256)",
  "function getPowerHistoryLength(address) view returns(uint256)",
  "function getPowerHistoryAt(address,uint256) view returns(address sourceUser,uint256 sourceDepositAmount,uint256 claimedCount,uint256 releasedAmount,uint256 claimedAmount,uint256 powerLevel,uint256 timestamp)",
];
const V1_POWER_MODULE_ABI = [
  "function activePowerLevel(address) view returns(uint256)",
  "function powerLevelStartedAt(address) view returns(uint256)",
  "function powerClaimedCount(address) view returns(uint256)",
  "function rawClaimable(address) view returns(uint256)",
];
const POWER_LEG_CAP_BPS = 4000n;
const BASIS_POINTS = 10000n;

const readInBatches = async (items, read, batchSize = 5) => {
  const results = [];
  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);
    results.push(...await Promise.all(batch.map(read)));
  }
  return results;
};

const card = (title, value, note = "") => (
  <div className="withdrawal-card">
    <p className="withdrawal-card-title">{title}</p>
    <h4 className="withdrawal-card-value">{value}</h4>
    {note ? <p className="withdrawal-card-title">{note}</p> : null}
  </div>
);

export const Income4 = () => {
  const [details, setDetails] = useState(null);
  const [levelDetails, setLevelDetails] = useState([]);
  const [powerTiming, setPowerTiming] = useState({ now: 0n, roiDay: 120n });
  const [registryAchievementAt, setRegistryAchievementAt] = useState(0n);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [legacyPower, setLegacyPower] = useState(null);
  const [v1Power, setV1Power] = useState(null);
  const [powerRecovery, setPowerRecovery] = useState(null);
  const [legacyPowerLevels, setLegacyPowerLevels] = useState({});
  const [nextPowerProgress, setNextPowerProgress] = useState({ level: 0, required: 0n, qualified: 0n });

  const loadPowerDetails = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const user = await getReadWalletAddress();
      if (!user || !ethers.isAddress(user)) {
        throw new Error("Connect wallet first");
      }

      const provider = createBscReadProvider();
      const manager = new ethers.Contract(
        PackageManagerAddress,
        V2PackageManagerABI,
        provider,
      );
      const incomeLens = new ethers.Contract(IncomeReadyLensAddress, V2PackageManagerABI, provider);

      const [powerDetails, powerReady, roiDay, latestBlock] = await Promise.all([
        incomeLens.getPowerDetails(user),
        incomeLens.getIncomeReady(user, 3),
        manager.ROI_DAY(),
        provider.getBlock("latest"),
      ]);
      const registry = new ethers.Contract(
        ReferralNetworkAddress,
        V2ReferralRegistryABI,
        provider,
      );
      const ledger = new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, provider);
      const checkpoint = new ethers.Contract(V2LegacyRankCheckpointAddress, RANK_CHECKPOINT_READ_ABI, provider);
      const [registryAchievedPowerRaw, powerHistoryLengthRaw] = await Promise.all([
        registry.getAchievedPowerLevel(user),
        ledger.getUserIncomeHistoryLengthByType(user, 3),
      ]);
      const powerHistory = await Promise.all(
        Array.from({ length: Number(powerHistoryLengthRaw) }, (_, index) =>
          ledger.getUserIncomeHistoryAtByType(user, 3, index),
        ),
      );
      // The ledger stores Power claims with their P-level. Keep the most
      // recent timestamp per level instead of incorrectly showing the one
      // global Manager timestamp in every P1/P2/P3 row.
      const lastPowerClaimAtByLevel = new Map();
      for (const record of powerHistory) {
        const level = Number(record.level ?? record[0] ?? 0n);
        const timestamp = BigInt(record.timestamp ?? record[2] ?? 0n);
        if (level && timestamp > BigInt(lastPowerClaimAtByLevel.get(level) ?? 0n)) {
          lastPowerClaimAtByLevel.set(level, timestamp);
        }
      }
      const powerLevel = Math.max(
        Number(powerDetails.activeLevel || powerDetails.achievedLevel || 0n),
        Number(registryAchievedPowerRaw ?? 0n),
      );
      const achievedAt = powerLevel
        ? await registry.powerAchievedAt(user, powerLevel)
        : 0n;
      const achievedPowerLevel = Math.max(
        Number(powerDetails.achievedLevel ?? 0n),
        Number(registryAchievedPowerRaw ?? 0n),
      );
      const levels = await Promise.all(
        Array.from({ length: achievedPowerLevel }, async (_, offset) => {
          const level = offset + 1;
          const [activatedAt, releasedCount, claimedAmount, claimedCount, pendingAmount, carriedAmount] = await Promise.all([
            registry.powerAchievedAt(user, level),
            manager.powerPayoutReleasedCountByLevel(user, level),
            manager.powerIncomeClaimedByLevel(user, level),
            manager.powerPayoutClaimedCountByLevel(user, level),
            manager.pendingPowerIncomeByLevel(user, level),
            manager.carriedPowerIncomeByLevel(user, level),
          ]);
          return {
            level,
            activatedAt,
            releasedCount,
            claimedAmount,
            claimedCount,
            lastClaimAt: lastPowerClaimAtByLevel.get(level) ?? 0n,
            pendingAmount: BigInt(pendingAmount) + BigInt(carriedAmount),
          };
        }),
      );

      const [legacySchedule, legacyPreview, recovery] = await Promise.all([
        checkpoint.getPowerSchedule(user),
        checkpoint.previewPowerClaimable(user),
        // This selector becomes available when the Rank-facet proposal is
        // executed. Keep the page compatible with the previous facet until
        // then; an unsupported selector means no user has been finalized yet.
        manager.getPowerIncomeRecovery(user).catch(() => null),
      ]);
      // V1 is read independently. For a rank finalized in V1, this live V1
      // record owns the baseline row while only higher ranks come from V2.
      const v1Manager = new ethers.Contract(V1_MAINNET.packageManager, V1_POWER_MANAGER_ABI, provider);
      const v1PowerModule = new ethers.Contract(await v1Manager.powerIncomeModule(), V1_POWER_MODULE_ABI, provider);
      const [v1Level, v1ActivatedAt, v1ClaimedCount, v1Claimable, v1TotalClaimed, v1LastClaimAt, v1NextPayoutAt, v1Day] = await Promise.all([
        v1PowerModule.activePowerLevel(user),
        v1PowerModule.powerLevelStartedAt(user),
        v1PowerModule.powerClaimedCount(user),
        v1PowerModule.rawClaimable(user),
        v1Manager.totalPowerIncomeClaimed(user),
        v1Manager.powerLastClaimAt(user),
        v1Manager.powerNextPayoutAt(user),
        v1Manager.oneDay(),
      ]);
      const v1HistoryLength = Number(await v1Manager.getPowerHistoryLength(user));
      const v1History = await Promise.all(
        Array.from({ length: v1HistoryLength }, (_, index) => v1Manager.getPowerHistoryAt(user, index)),
      );

      // V3 snapshots only retain the continuing rank. Read historical rank
      // rows from V2 and V1 so P1/P2/P3 remain visible after migration.
      const legacyManager = new ethers.Contract(LegacyV2PackageManagerAddress, V2PackageManagerABI, provider);
      const legacyRegistry = new ethers.Contract(LegacyV2RegistryAddress, V2ReferralRegistryABI, provider);
      const legacyAchieved = Number(await legacyRegistry.getAchievedPowerLevel(user).catch(() => 0n));
      const legacyRows = await Promise.all(Array.from({ length: legacyAchieved }, async (_, offset) => {
        const level = offset + 1;
        const [activatedAt, releasedCount, claimedAmount, claimedCount] = await Promise.all([
          legacyRegistry.powerAchievedAt(user, level).catch(() => 0n),
          legacyManager.powerPayoutReleasedCountByLevel(user, level).catch(() => 0n),
          legacyManager.powerIncomeClaimedByLevel(user, level).catch(() => 0n),
          legacyManager.powerPayoutClaimedCountByLevel(user, level).catch(() => 0n),
        ]);
        return { level, activatedAt, releasedCount, claimedAmount, claimedCount, lastClaimAt: 0n };
      }));
      const fallbackByLevel = {};
      for (const row of v1History) {
        const level = Number(row.powerLevel ?? row[5] ?? 0n);
        if (!level) continue;
        const previous = fallbackByLevel[level] ?? {
          level, activatedAt: 0n, releasedCount: 0n, claimedAmount: 0n, claimedCount: 0n, lastClaimAt: 0n,
        };
        fallbackByLevel[level] = {
          ...previous,
          // A V1 history row already contains the total released/claimed
          // amount for its closed rank cycle; combine only same-level rows.
          releasedCount: BigInt(previous.releasedCount) + (BigInt(row.releasedAmount ?? row[3] ?? 0n) / (level === 1 ? 25n * 10n ** 18n : level === 2 ? 50n * 10n ** 18n : level === 3 ? 100n * 10n ** 18n : level === 4 ? 250n * 10n ** 18n : level === 5 ? 500n * 10n ** 18n : level === 6 ? 1000n * 10n ** 18n : level === 7 ? 2500n * 10n ** 18n : level === 8 ? 5000n * 10n ** 18n : 10000n * 10n ** 18n)),
          claimedAmount: BigInt(previous.claimedAmount) + BigInt(row.claimedAmount ?? row[4] ?? 0n),
          claimedCount: BigInt(previous.claimedCount) + BigInt(row.claimedCount ?? row[2] ?? 0n),
          lastClaimAt: BigInt(row.timestamp ?? row[6] ?? 0n) > BigInt(previous.lastClaimAt) ? BigInt(row.timestamp ?? row[6] ?? 0n) : previous.lastClaimAt,
        };
      }
      // V2 is newer than V1 for a rank only if it actually has a stored
      // payment value. Otherwise retain the complete V1 historic row.
      for (const row of legacyRows) {
        if (BigInt(row.releasedCount) || BigInt(row.claimedAmount) || BigInt(row.claimedCount)) {
          fallbackByLevel[row.level] = row;
        }
      }
      // The lens only knows the Registry's V2 rank. A migrated V1/checkpoint
      // rank can be higher, so compute the next target from the highest rank
      // shown to the user rather than incorrectly resetting the UI to P1.
      const effectiveAchievedLevel = Math.max(
        Number(powerDetails.achievedLevel ?? 0n),
        legacySchedule.set ? Number(legacySchedule.level ?? 0n) : 0,
        Number(v1Level ?? 0n),
      );
      const nextPowerLevel = effectiveAchievedLevel < 9 ? effectiveAchievedLevel + 1 : 0;
      let nextThreshold = 0n;
      let nextQualified = 0n;
      if (nextPowerLevel) {
        // Legacy leg business has already been imported into V3. Preview the
        // V3 Registry state only; adding V1/V2 again would double-count it.
        const [threshold, directCount] = await Promise.all([
          registry.powerThreshold(nextPowerLevel),
          registry.getLevelUsersLength(user, 0),
        ]);
        nextThreshold = BigInt(threshold);
        const directIndexes = Array.from({ length: Number(directCount) }, (_, index) => index);
        const directs = await readInBatches(
          directIndexes,
          (index) => registry.getLevelUserAt(user, 0, index),
        );
        const perLegCap = (nextThreshold * POWER_LEG_CAP_BPS) / BASIS_POINTS;
        const legQualified = await readInBatches(directs, async (direct) => {
          const [business, hasEverPackage, legacyCounted] = await Promise.all([
            registry.legBusiness(user, direct),
            registry.hasEverPackage(direct),
            registry.legacyDirectCounted(direct),
          ]);
          const eligible = Boolean(hasEverPackage) || Boolean(legacyCounted);
          if (!eligible) return 0n;
          const v3Business = BigInt(business);
          return v3Business > perLegCap ? perLegCap : v3Business;
        });
        nextQualified = legQualified.reduce((total, amount) => total + amount, 0n);
      }
      // The card is deliberately sourced from V3's ready-income lens. V1/V2
      // rows are history only; adding them here would show a balance that the
      // active V3 claim function cannot necessarily pay.
      setDetails({ ...powerDetails, readyAmount: powerReady });
      setLegacyPower(legacySchedule.set ? {
        originalAchievedAt: legacySchedule.originalAchievedAt,
        nextInstallmentAt: legacySchedule.nextInstallmentAt,
        paidInstallments: legacySchedule.paidInstallments,
        unpaidAmount: legacySchedule.unpaidAmount,
        level: legacySchedule.level,
        claimableAmount: legacyPreview[1],
      } : null);
      setPowerRecovery(recovery ? {
        finalizedInV1: recovery.finalizedInV1,
        baselineLevel: recovery.baselineLevel,
        remainingDebt: recovery.remainingDebt,
        totalRecovered: recovery.totalRecovered,
      } : null);
      setV1Power(BigInt(v1Level) > 0n ? {
        level: v1Level,
        activatedAt: v1ActivatedAt,
        claimedCount: v1ClaimedCount,
        claimableAmount: v1Claimable,
        totalClaimed: v1TotalClaimed,
        lastClaimAt: v1LastClaimAt,
        nextPayoutAt: v1NextPayoutAt,
        day: v1Day,
      } : null);
      setLegacyPowerLevels(fallbackByLevel);
      setNextPowerProgress({
        level: nextPowerLevel,
        required: BigInt(nextThreshold) > BigInt(nextQualified)
          ? BigInt(nextThreshold) - BigInt(nextQualified)
          : 0n,
        qualified: nextQualified,
      });
      setLevelDetails(levels);
      setPowerTiming({ now: BigInt(latestBlock?.timestamp ?? 0), roiDay: BigInt(roiDay ?? 120n) });
      setRegistryAchievementAt(achievedAt);
    } catch (error) {
      setDetails(null);
      setLevelDetails([]);
      setPowerTiming({ now: 0n, roiDay: 120n });
      setRegistryAchievementAt(0n);
      setLegacyPower(null);
      setV1Power(null);
      setLegacyPowerLevels({});
      setPowerRecovery(null);
      setNextPowerProgress({ level: 0, required: 0n, qualified: 0n });
      setMessage(error?.shortMessage || error?.message || "Could not load Power details");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPowerDetails();
  }, [loadPowerDetails]);

  const nativeActiveLevel = Number(details?.activeLevel ?? 0n);
  const nativeAchievedLevel = Number(details?.achievedLevel ?? 0n);
  const finalizedInV1 = Boolean(powerRecovery?.finalizedInV1);
  const v1BaselineLevel = finalizedInV1 ? Number(powerRecovery?.baselineLevel ?? 0n) : 0;
  const finalizedBaselineMatchesV1 = Boolean(
    finalizedInV1 &&
    v1Power &&
    Number(v1Power.level) === v1BaselineLevel
  );
  // A number of early V1->V3 rank imports copied the achieved P-level and
  // activation time but not its already-paid installment baseline. Detect
  // that exact state generically: V1 has paid cycles for the same active
  // level while V3 has no counters or pending balance at all. V1 is then the
  // truthful historical source until the on-chain snapshot is repaired.
  const v1LevelMatchesEmptyV3 = Boolean(
    v1Power
    && Number(v1Power.level) === nativeActiveLevel
    && BigInt(v1Power.claimedCount ?? 0n) > 0n
    && (() => {
      const nativeRow = levelDetails.find((item) => Number(item.level) === nativeActiveLevel);
      return nativeRow
        && BigInt(nativeRow.releasedCount ?? 0n) === 0n
        && BigInt(nativeRow.claimedCount ?? 0n) === 0n
        && BigInt(nativeRow.claimedAmount ?? 0n) === 0n
        && BigInt(nativeRow.pendingAmount ?? 0n) === 0n;
    })()
  );
  const v1BaselineAuthoritative = finalizedBaselineMatchesV1 || v1LevelMatchesEmptyV3;
  const visibleLevelDetails = levelDetails;
  // Before finalization a checkpoint is a V2-paid schedule and continues to
  // take precedence. After finalization the matching baseline belongs to V1.
  const v2RankLevels = new Set([
    ...visibleLevelDetails.map((item) => Number(item.level)),
    ...(!finalizedInV1 && legacyPower ? [Number(legacyPower.level)] : []),
  ].filter(Boolean));
  const showV1Power = Boolean(
    v1Power &&
    (v1BaselineAuthoritative || !v2RankLevels.has(Number(v1Power.level)))
  );
  const activeLevel = Math.max(
    nativeActiveLevel,
    finalizedInV1 ? 0 : Number(legacyPower?.level ?? 0n),
    Number(v1Power?.level ?? 0n),
  );
  const achievedLevel = Math.max(
    nativeAchievedLevel,
    finalizedInV1 ? 0 : Number(legacyPower?.level ?? 0n),
    Number(v1Power?.level ?? 0n),
  );
  const hasHigherV2Power = v1BaselineAuthoritative && nativeActiveLevel > Number(v1Power?.level ?? 0n);
  const nextLevel = nextPowerProgress.level;
  const qualified = formatUsdt(nextPowerProgress.qualified);
  const required = formatUsdt(nextPowerProgress.required);
  const powerTime = v1BaselineAuthoritative && !hasHigherV2Power
    ? BigInt(v1Power?.activatedAt ?? 0n)
    : BigInt(finalizedInV1 ? 0n : legacyPower?.originalAchievedAt ?? 0n) || BigInt(details?.activatedAt ?? 0n) || registryAchievementAt || BigInt(v1Power?.activatedAt ?? 0n);
  const powerClaimable = v1BaselineAuthoritative && !hasHigherV2Power
    ? BigInt(v1Power?.claimableAmount ?? 0n)
    : BigInt(details?.readyAmount ?? 0n);
  const visibleV2Claimed = visibleLevelDetails.reduce(
    (total, item) => total + BigInt(item.claimedAmount ?? 0n),
    0n,
  );
  const powerClaimed = v1BaselineAuthoritative && !hasHigherV2Power
    ? BigInt(v1Power?.totalClaimed ?? 0n)
    : finalizedInV1
    ? visibleV2Claimed + (showV1Power ? BigInt(v1Power?.totalClaimed ?? 0n) : 0n)
    : BigInt(details?.totalClaimed ?? 0n) + (showV1Power ? BigInt(v1Power?.totalClaimed ?? 0n) : 0n);
  const displayedReleasedCount = v1BaselineAuthoritative && !hasHigherV2Power
    ? (() => {
        const startedAt = BigInt(v1Power?.activatedAt ?? 0n);
        const day = BigInt(v1Power?.day ?? 0n);
        if (!startedAt || !day || powerTiming.now < startedAt) return Number(v1Power?.claimedCount ?? 0n);
        const released = ((powerTiming.now - startedAt) / (10n * day)) + 1n;
        return Number(released > 20n ? 20n : released);
      })()
    : Number(details?.releasedCount ?? 0n);
  const displayedClaimedCount = v1BaselineAuthoritative && !hasHigherV2Power
    ? Number(v1Power?.claimedCount ?? 0n)
    : Number(details?.claimedCount ?? 0n);
  const displayedLastClaimAt = v1BaselineAuthoritative && !hasHigherV2Power
    ? v1Power?.lastClaimAt
    : details?.lastClaimAt;
  const historyColumns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "level", label: "Power Level", sortable: true },
    { id: "activatedAt", label: "Activated At", sortable: true },
    { id: "releasedCount", label: "Released Cycles", sortable: true },
    { id: "claimedCount", label: "Claimed Cycles", sortable: true },
    { id: "claimedAmount", label: "Claimed Amount", sortable: true },
    { id: "lastClaimAt", label: "Last Claim Time", sortable: true },
  ];
  const v2HistoryRows = visibleLevelDetails.map((item) => {
    const fallback = legacyPowerLevels[item.level];
    const hasV3Snapshot = !v1BaselineAuthoritative && (BigInt(item.releasedCount ?? 0n) !== 0n ||
      BigInt(item.claimedAmount ?? 0n) !== 0n || BigInt(item.claimedCount ?? 0n) !== 0n ||
      BigInt(item.pendingAmount ?? 0n) !== 0n || Number(item.level) === nativeActiveLevel);
    const displayed = hasV3Snapshot ? item : (fallback ?? item);
    let releasedCount = Number(displayed.releasedCount ?? 0n);
    if (Number(displayed.level) === activeLevel && displayed.activatedAt && powerTiming.now >= displayed.activatedAt) {
      const virtualReleased = ((powerTiming.now - displayed.activatedAt) / (10n * powerTiming.roiDay)) + 1n;
      releasedCount = Math.max(releasedCount, Number(virtualReleased > 20n ? 20n : virtualReleased));
    }
    return {
      level: `P${displayed.level}`,
      activatedAt: formatTime(displayed.activatedAt),
      releasedCount: `${releasedCount} / 20`,
      claimedCount: Number(displayed.claimedCount ?? 0n),
      claimedAmount: formatUsdt(displayed.claimedAmount),
      lastClaimAt: formatTime(displayed.lastClaimAt),
    };
  });
  // `getPowerDetails` exposes the continuing V3 rank only. Preserve every
  // older P-level read manually from V1/V2 when V3 has no snapshot for that
  // level, otherwise a migrated user would only see their latest rank.
  const fallbackHistoryRows = Object.values(legacyPowerLevels)
    .filter((item) => item?.level && !v2HistoryRows.some((row) => row.level === `P${item.level}`))
    .map((item) => ({
      level: `P${item.level}`,
      activatedAt: formatTime(item.activatedAt),
      releasedCount: `${Number(item.releasedCount ?? 0n)} / 20`,
      claimedCount: Number(item.claimedCount ?? 0n),
      claimedAmount: formatUsdt(item.claimedAmount),
      lastClaimAt: formatTime(item.lastClaimAt),
    }));
  const historyRows = [
    ...v2HistoryRows,
    ...fallbackHistoryRows,
    // The rank checkpoint is stored and paid by V2. Keep it as a V2 row;
    // this prevents the old V1 P-level from appearing twice after migration.
    ...(!finalizedInV1 && legacyPower && !v2HistoryRows.some((item) => item.level === `P${legacyPower.level}`) ? [{
      level: `P${legacyPower.level}`,
      activatedAt: formatTime(legacyPower.originalAchievedAt),
      releasedCount: `${legacyPower.paidInstallments} / 20`,
      claimedCount: Number(legacyPower.paidInstallments),
      claimedAmount: "-",
      lastClaimAt: "V2 migrated schedule",
    }] : []),
    ...(showV1Power && !fallbackHistoryRows.some((item) => item.level === `P${v1Power.level}`) ? [{
      level: `P${v1Power.level}`,
      activatedAt: formatTime(v1Power.activatedAt),
      releasedCount: `${finalizedBaselineMatchesV1 ? displayedReleasedCount : v1Power.claimedCount} / 20`,
      claimedCount: Number(v1Power.claimedCount),
      claimedAmount: formatUsdt(v1Power.totalClaimed),
      lastClaimAt: formatTime(v1Power.lastClaimAt),
    }] : []),
  ]
    .sort((a, b) => Number(a.level.slice(1)) - Number(b.level.slice(1)))
    .map((item, index) => ({ ...item, sno: index + 1 }));

  return (
    <div className="page-container">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">Power Details</h2>
        <button className="btn btn-primary" onClick={loadPowerDetails} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="withdrawal-grid" style={{ marginBottom: "14px" }}>
        {card("Active Power Level", activeLevel ? `P${activeLevel}` : "0")}
        {card("Achieved Power Level (Now)", achievedLevel ? `P${achievedLevel}` : "0")}
        {card("Power Level Activated At", formatTime(powerTime))}
        {card("Total Power Income Claimed", formatUsdt(powerClaimed))}
        {card(
          "Power Income Claimable",
          formatUsdt(powerClaimable),
          `Released: ${displayedReleasedCount} | Claimed: ${displayedClaimedCount}`,
        )}
        {card("Power Last Claim At", formatTime(displayedLastClaimAt))}
        {card("Next Achieve Power", nextLevel ? `P${nextLevel}` : "Max achieved")}
        {card(
          "Next Achieve Power Business",
          required,
          `Qualified business: ${qualified}`,
        )}
        {card(
          "Next Power Payout At",
          // A historical migrated schedule (for example P2) must not
          // override the payout date of the user's current native V2 rank
          // (for example active P3). Fall back to it only when no V2 Power
          // level is active.
          formatTime(
            v1BaselineAuthoritative && !hasHigherV2Power
              ? v1Power?.nextPayoutAt
              : nativeActiveLevel
                ? details?.nextPayoutAt
                : legacyPower?.nextInstallmentAt ?? details?.nextPayoutAt
          ),
        )}
      </div>

      {message ? <p className="text-danger">{message}</p> : null}

      <h4 className="mt-4 mb-3">Power Claim History</h4>

      <CustomTable
        columns={historyColumns}
        rows={historyRows}
        renderRow={(row) => (
          <>
            <TableCell align="center">{row.sno}</TableCell>
            <TableCell align="center">{row.level}</TableCell>
            <TableCell align="center">{row.activatedAt}</TableCell>
            <TableCell align="center">{row.releasedCount}</TableCell>
            <TableCell align="center">{row.claimedCount}</TableCell>
            <TableCell align="center">{row.claimedAmount}</TableCell>
            <TableCell align="center">{row.lastClaimAt}</TableCell>
          </>
        )}
      />
    </div>
  );
};

export default Income4;
