import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { TableCell } from "@mui/material";
import CustomTable from "../CommonComponents/CustomTable";
import V2PackageManagerABI from "../../../blockchain/v2PackageManagerABI";
import V2ReferralRegistryABI from "../../../blockchain/v2ReferralRegistryABI";
import { PackageManagerAddress, ReferralNetworkAddress, V2LegacyRankCheckpointAddress } from "../../../blockchain/address";
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
];
const V1_POWER_MODULE_ABI = [
  "function activePowerLevel(address) view returns(uint256)",
  "function powerLevelStartedAt(address) view returns(uint256)",
  "function powerClaimedCount(address) view returns(uint256)",
  "function rawClaimable(address) view returns(uint256)",
];
const V1_POWER_REGISTRY_ABI = [
  "function users(address user) view returns(uint256 id,address referral,uint256 registeredAt,uint256 totalTeam,uint256 totalTeamDeposit,uint256 selfDeposit,uint256 totalTeamStakeToken,uint256 selfStakeToken,bool exists)",
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
      const incomeLens = new ethers.Contract(
        await manager.incomeReadyLens(),
        V2PackageManagerABI,
        provider,
      );

      const [powerDetails, roiDay, latestBlock] = await Promise.all([
        incomeLens.getPowerDetails(user),
        manager.ROI_DAY(),
        provider.getBlock("latest"),
      ]);
      const registry = new ethers.Contract(
        ReferralNetworkAddress,
        V2ReferralRegistryABI,
        provider,
      );
      const checkpoint = new ethers.Contract(V2LegacyRankCheckpointAddress, RANK_CHECKPOINT_READ_ABI, provider);
      const powerLevel = Number(powerDetails.activeLevel || powerDetails.achievedLevel || 0n);
      const achievedAt = powerLevel
        ? await registry.powerAchievedAt(user, powerLevel)
        : 0n;
      const achievedPowerLevel = Number(powerDetails.achievedLevel ?? 0n);
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
            pendingAmount: BigInt(pendingAmount) + BigInt(carriedAmount),
          };
        }),
      );

      const [legacySchedule, legacyPreview] = await Promise.all([
        checkpoint.getPowerSchedule(user),
        checkpoint.previewPowerClaimable(user),
      ]);
      // V1 is read independently. Its active rank is displayed alongside V2
      // unless that same P-level already exists in V2 (V2 then wins).
      const v1Manager = new ethers.Contract(V1_MAINNET.packageManager, V1_POWER_MANAGER_ABI, provider);
      const v1PowerModule = new ethers.Contract(await v1Manager.powerIncomeModule(), V1_POWER_MODULE_ABI, provider);
      const v1PowerRegistry = new ethers.Contract(V1_MAINNET.referralNetwork, V1_POWER_REGISTRY_ABI, provider);
      const [v1Level, v1ActivatedAt, v1ClaimedCount, v1Claimable, v1TotalClaimed] = await Promise.all([
        v1PowerModule.activePowerLevel(user),
        v1PowerModule.powerLevelStartedAt(user),
        v1PowerModule.powerClaimedCount(user),
        v1PowerModule.rawClaimable(user),
        v1Manager.totalPowerIncomeClaimed(user),
      ]);
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
        // Preview the exact V2 next-rank formula in the UI. Each V2 direct
        // leg contributes its V2 business plus its eligible V1 baseline,
        // then that leg is capped at 40% of the V2 threshold. No contract
        // state is changed here; this is a read-only preview until V2's
        // legacy-leg migration has completed on-chain.
        const [threshold, legacyLegsImported, directCount] = await Promise.all([
          registry.powerThreshold(nextPowerLevel),
          registry.legacyLegsReady(user),
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
          const [v2Business, importedLegacyBusiness, isMigrated, hasEverPackage, legacyCounted, v1User] = await Promise.all([
            registry.legBusiness(user, direct),
            registry.legacyLegBusiness(user, direct),
            registry.migrated(direct),
            registry.hasEverPackage(direct),
            registry.legacyDirectCounted(direct),
            v1PowerRegistry.users(direct).catch(() => null),
          ]);
          const eligible = Boolean(hasEverPackage) || Boolean(legacyCounted);
          if (!eligible) return 0n;

          // legBusiness already includes an individually imported V1 leg.
          // For a leg not yet imported, add its V1 snapshot locally only for
          // this read-only preview. This also handles a partially completed
          // legacy-leg migration without double counting.
          const v1Business = isMigrated && v1User
            ? BigInt(v1User.totalTeamDeposit ?? 0n) + BigInt(v1User.selfDeposit ?? 0n)
            : 0n;
          const combinedBusiness = BigInt(v2Business)
            + (legacyLegsImported || BigInt(importedLegacyBusiness) > 0n ? 0n : v1Business);
          return combinedBusiness > perLegCap ? perLegCap : combinedBusiness;
        });
        nextQualified = legQualified.reduce((total, amount) => total + amount, 0n);
      }
      setDetails(powerDetails);
      setLegacyPower(legacySchedule.set ? {
        originalAchievedAt: legacySchedule.originalAchievedAt,
        nextInstallmentAt: legacySchedule.nextInstallmentAt,
        paidInstallments: legacySchedule.paidInstallments,
        unpaidAmount: legacySchedule.unpaidAmount,
        level: legacySchedule.level,
        claimableAmount: legacyPreview[1],
      } : null);
      setV1Power(BigInt(v1Level) > 0n ? {
        level: v1Level,
        activatedAt: v1ActivatedAt,
        claimedCount: v1ClaimedCount,
        claimableAmount: v1Claimable,
        totalClaimed: v1TotalClaimed,
      } : null);
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
  // A migrated checkpoint is V2 data too. Its rank takes precedence over a
  // matching historical V1 P-level, just like a native V2 rank does.
  const v2RankLevels = new Set([
    ...levelDetails.map((item) => Number(item.level)),
    ...(legacyPower ? [Number(legacyPower.level)] : []),
  ].filter(Boolean));
  const showV1Power = Boolean(v1Power && !v2RankLevels.has(Number(v1Power.level)));
  const activeLevel = nativeActiveLevel || Number(legacyPower?.level ?? 0n) || Number(v1Power?.level ?? 0n);
  const achievedLevel = nativeAchievedLevel || Number(legacyPower?.level ?? 0n) || Number(v1Power?.level ?? 0n);
  const nextLevel = nextPowerProgress.level;
  const qualified = formatUsdt(nextPowerProgress.qualified);
  const required = formatUsdt(nextPowerProgress.required);
  const powerTime = BigInt(legacyPower?.originalAchievedAt ?? 0n) || BigInt(details?.activatedAt ?? 0n) || registryAchievementAt || BigInt(v1Power?.activatedAt ?? 0n);
  const powerClaimable = BigInt(details?.claimableAmount ?? 0n)
    + BigInt(legacyPower?.claimableAmount ?? 0n)
    + (showV1Power ? BigInt(v1Power?.claimableAmount ?? 0n) : 0n);
  const powerClaimed = BigInt(details?.totalClaimed ?? 0n)
    + (showV1Power ? BigInt(v1Power?.totalClaimed ?? 0n) : 0n);
  const historyColumns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "level", label: "Power Level", sortable: true },
    { id: "activatedAt", label: "Activated At", sortable: true },
    { id: "releasedCount", label: "Released Cycles", sortable: true },
    { id: "claimedCount", label: "Claimed Cycles", sortable: true },
    { id: "claimedAmount", label: "Claimed Amount", sortable: true },
    { id: "lastClaimAt", label: "Last Claim Time", sortable: true },
  ];
  const v2HistoryRows = levelDetails.map((item) => {
    const lastClaim = details?.lastClaimAt ?? 0n;
    let releasedCount = Number(item.releasedCount);
    if (item.level === activeLevel && item.activatedAt && powerTiming.now >= item.activatedAt) {
      const virtualReleased = ((powerTiming.now - item.activatedAt) / (10n * powerTiming.roiDay)) + 1n;
      releasedCount = Math.max(releasedCount, Number(virtualReleased > 20n ? 20n : virtualReleased));
    }
    return {
      level: `P${item.level}`,
      activatedAt: formatTime(item.activatedAt),
      releasedCount: `${releasedCount} / 20`,
      claimedCount: Number(item.claimedCount),
      claimedAmount: formatUsdt(item.claimedAmount),
      lastClaimAt: formatTime(lastClaim),
    };
  });
  const historyRows = [
    ...v2HistoryRows,
    // The rank checkpoint is stored and paid by V2. Keep it as a V2 row;
    // this prevents the old V1 P-level from appearing twice after migration.
    ...(legacyPower && !v2HistoryRows.some((item) => item.level === `P${legacyPower.level}`) ? [{
      level: `P${legacyPower.level}`,
      activatedAt: formatTime(legacyPower.originalAchievedAt),
      releasedCount: `${legacyPower.paidInstallments} / 20`,
      claimedCount: Number(legacyPower.paidInstallments),
      claimedAmount: "-",
      lastClaimAt: "V2 migrated schedule",
    }] : []),
    ...(showV1Power ? [{
      level: `P${v1Power.level}`,
      activatedAt: formatTime(v1Power.activatedAt),
      releasedCount: `${v1Power.claimedCount} / 20`,
      claimedCount: Number(v1Power.claimedCount),
      claimedAmount: formatUsdt(v1Power.totalClaimed),
      lastClaimAt: "V1 active record",
    }] : []),
  ].map((item, index) => ({ ...item, sno: index + 1 }));

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
          `Released: ${Number(details?.releasedCount ?? 0n)} | Claimed: ${Number(details?.claimedCount ?? 0n)}`,
        )}
        {legacyPower ? card("V1 Pending Power (Migrated)", formatUsdt(legacyPower.claimableAmount), `P${legacyPower.level} | Paid: ${legacyPower.paidInstallments}`) : null}
        {card("Power Last Claim At", formatTime(details?.lastClaimAt))}
        {card("Next Achieve Power", nextLevel ? `P${nextLevel}` : "Max achieved")}
        {card(
          "Next Achieve Power Business",
          required,
          `Qualified business: ${qualified} (V1 + V2, max 40% per leg)`,
        )}
        {card(
          "Next Power Payout At",
          // A historical migrated schedule (for example P2) must not
          // override the payout date of the user's current native V2 rank
          // (for example active P3). Fall back to it only when no V2 Power
          // level is active.
          formatTime(nativeActiveLevel ? details?.nextPayoutAt : legacyPower?.nextInstallmentAt ?? details?.nextPayoutAt),
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
