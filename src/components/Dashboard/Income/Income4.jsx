import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { TableCell } from "@mui/material";
import CustomTable from "../CommonComponents/CustomTable";
import V2PackageManagerABI from "../../../blockchain/v2PackageManagerABI";
import V2ReferralRegistryABI from "../../../blockchain/v2ReferralRegistryABI";
import { PackageManagerAddress, ReferralNetworkAddress, V2LegacyRankCheckpointAddress } from "../../../blockchain/address";
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
  "function getPowerSchedule(address) view returns(uint256 originalAchievedAt,uint256 nextInstallmentAt,uint256 paidInstallments,uint256 releasedAfterCutover,uint256 unpaidAmount,uint256 level,bool set)"
];

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

      const legacySchedule = await checkpoint.getPowerSchedule(user);
      setDetails(powerDetails);
      setLegacyPower(legacySchedule.set ? legacySchedule : null);
      setLevelDetails(levels);
      setPowerTiming({ now: BigInt(latestBlock?.timestamp ?? 0), roiDay: BigInt(roiDay ?? 120n) });
      setRegistryAchievementAt(achievedAt);
    } catch (error) {
      setDetails(null);
      setLevelDetails([]);
      setPowerTiming({ now: 0n, roiDay: 120n });
      setRegistryAchievementAt(0n);
      setLegacyPower(null);
      setMessage(error?.shortMessage || error?.message || "Could not load Power details");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPowerDetails();
  }, [loadPowerDetails]);

  const activeLevel = Number(details?.activeLevel ?? 0n);
  const achievedLevel = Number(details?.achievedLevel ?? 0n);
  const nextLevel = Number(details?.nextLevel ?? 0n);
  const qualified = formatUsdt(details?.nextQualifiedBusiness);
  const required = formatUsdt(details?.nextRequiredBusiness);
  const powerTime = BigInt(legacyPower?.originalAchievedAt ?? 0n) || BigInt(details?.activatedAt ?? 0n) || registryAchievementAt;
  const powerClaimable = BigInt(details?.claimableAmount ?? 0n) + BigInt(legacyPower?.unpaidAmount ?? 0n);
  const historyColumns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "level", label: "Power Level", sortable: true },
    { id: "activatedAt", label: "Activated At", sortable: true },
    { id: "releasedCount", label: "Released Cycles", sortable: true },
    { id: "claimedCount", label: "Claimed Cycles", sortable: true },
    { id: "claimedAmount", label: "Claimed Amount", sortable: true },
    { id: "lastClaimAt", label: "Last Claim Time", sortable: true },
  ];
  const historyRows = levelDetails.map((item, index) => {
    const lastClaim = details?.lastClaimAt ?? 0n;
    let releasedCount = Number(item.releasedCount);
    if (item.level === activeLevel && item.activatedAt && powerTiming.now >= item.activatedAt) {
      const virtualReleased = ((powerTiming.now - item.activatedAt) / (10n * powerTiming.roiDay)) + 1n;
      releasedCount = Math.max(releasedCount, Number(virtualReleased > 20n ? 20n : virtualReleased));
    }
    return {
      sno: index + 1,
      level: `P${item.level}`,
      activatedAt: formatTime(item.activatedAt),
      releasedCount: `${releasedCount} / 20`,
      claimedCount: Number(item.claimedCount),
      claimedAmount: formatUsdt(item.claimedAmount),
      lastClaimAt: formatTime(lastClaim),
    };
  });

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
        {card("Total Power Income Claimed", formatUsdt(details?.totalClaimed))}
        {card(
          "Power Income Claimable",
          formatUsdt(powerClaimable),
          `Released: ${Number(details?.releasedCount ?? 0n)} | Claimed: ${Number(details?.claimedCount ?? 0n)}`,
        )}
        {legacyPower ? card("V1 Pending Power (Migrated)", formatUsdt(legacyPower.unpaidAmount), `P${legacyPower.level} | Paid: ${legacyPower.paidInstallments}`) : null}
        {card("Power Last Claim At", formatTime(details?.lastClaimAt))}
        {card("Next Achieve Power", nextLevel ? `P${nextLevel}` : "Max achieved")}
        {card(
          "Next Achieve Power Business",
          required,
          `Qualified business: ${qualified}`,
        )}
        {card("Next Power Payout At", formatTime(legacyPower?.nextInstallmentAt ?? details?.nextPayoutAt))}
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
