import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import ReferralNetworkABI from "../../../blockchain/referralNetworkABI.json";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import { ReferralNetworkAddress } from "../../../blockchain/address";

const formatTimestamp = (value) => {
  const timestamp = Number(value);
  if (!timestamp) {
    return "-";
  }

  return new Date(timestamp * 1000).toLocaleString();
};

const formatEther4 = (value) => {
  try {
    const etherValue = ethers.formatEther(value ?? 0n);
    const [whole, fraction = ""] = etherValue.split(".");
    return `${whole}.${(fraction + "0000").slice(0, 4)}`;
  } catch {
    return "0.0000";
  }
};

const renderRewardCard = (title, value) => (
  <div className="withdrawal-card" key={title}>
    <p className="withdrawal-card-title">{title}</p>
    <h4 className="withdrawal-card-value">{value}</h4>
  </div>
);

export const LevelRoiRewardPanel = () => {
  const [selectedRewardLevel, setSelectedRewardLevel] = useState("0");
  const [selectedDay, setSelectedDay] = useState("");
  const [currentDay, setCurrentDay] = useState(0);
  const [rewardData, setRewardData] = useState(null);
  const [isRewardLoading, setIsRewardLoading] = useState(false);
  const [rewardError, setRewardError] = useState("");

  const rewardLevels = Array.from({ length: 15 }, (_, i) => ({
    label: `Level ${i + 1}`,
    value: i.toString(),
  }));
  const dayOptions = Array.from({ length: currentDay }, (_, index) =>
    (currentDay - index).toString(),
  );

  const getWalletAddress = async () => {
    if (!window.ethereum) {
      return "";
    }

    const walletAddress = await getReadWalletAddress();
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return "";
    }

    return walletAddress;
  };

  useEffect(() => {
    const fetchCurrentDay = async () => {
      if (!window.ethereum) {
        setCurrentDay(0);
        setSelectedDay("");
        return;
      }

      try {
        const walletAddress = await getWalletAddress();
        if (!walletAddress) {
          setCurrentDay(0);
          setSelectedDay("");
          return;
        }

        const provider = createBscReadProvider();
        const referralContract = new ethers.Contract(
          ReferralNetworkAddress,
          ReferralNetworkABI,
          provider,
        );

        const registeredDays = await referralContract.getRegisteredDays(walletAddress);
        const dayValue = Number(registeredDays?.currentDay ?? registeredDays?.[1] ?? 0n);
        const safeDayValue = Number.isFinite(dayValue) ? Math.max(dayValue, 0) : 0;

        setCurrentDay(safeDayValue);
        if (safeDayValue > 0) {
          setSelectedDay((prevDay) => {
            if (!prevDay) {
              return safeDayValue.toString();
            }
            return Number(prevDay) <= safeDayValue ? prevDay : safeDayValue.toString();
          });
        } else {
          setSelectedDay("");
        }
      } catch {
        setCurrentDay(0);
        setSelectedDay("");
      }
    };

    fetchCurrentDay();
  }, []);

  useEffect(() => {
    const fetchRewardData = async () => {
      if (!window.ethereum || !selectedDay) {
        setRewardData(null);
        setRewardError("");
        return;
      }

      try {
        setIsRewardLoading(true);
        setRewardError("");

        const walletAddress = await getWalletAddress();
        if (!walletAddress) {
          setRewardData(null);
          setRewardError("");
          return;
        }

        const provider = createBscReadProvider();
        const referralContract = new ethers.Contract(
          ReferralNetworkAddress,
          ReferralNetworkABI,
          provider,
        );

        const userDay = Number(selectedDay);
        const levelIndex = Number(selectedRewardLevel);
        const levelData = await referralContract.getLevelDailyRewardByUserDay(
          walletAddress,
          levelIndex,
          userDay,
        );

        const reward = levelData?.reward ?? levelData?.[0] ?? 0n;
        const levelOpen = levelData?.levelOpen ?? levelData?.[1] ?? false;
        const dayStart = levelData?.dayStart ?? levelData?.[2] ?? 0n;
        const dayEnd = levelData?.dayEnd ?? levelData?.[3] ?? 0n;

        setRewardData({
          reward: formatEther4(reward),
          level: levelIndex + 1,
          isOpen: Boolean(levelOpen),
          dayStart: formatTimestamp(dayStart),
          dayEnd: formatTimestamp(dayEnd),
        });
      } catch (error) {
        setRewardData(null);
        setRewardError(
          error?.shortMessage ||
            error?.reason ||
            error?.message ||
            "Failed to load ROI reward.",
        );
      } finally {
        setIsRewardLoading(false);
      }
    };

    fetchRewardData();
  }, [selectedDay, selectedRewardLevel]);

  const resolvedLevel = rewardData?.level ?? Number(selectedRewardLevel) + 1;
  const resolvedDay = selectedDay || "-";
  const resolvedReward = rewardData?.reward ?? "0.00";
  const resolvedStatus = rewardData
    ? rewardData.isOpen
      ? "Open"
      : "Locked"
    : "-";
  const resolvedDayStart = rewardData?.dayStart ?? "-";
  const resolvedDayEnd = rewardData?.dayEnd ?? "-";

  return (
    <>
      <div className="team-reward-controls">
        <div className="team-reward-control-item">
          <label htmlFor="income-day-select">Day</label>
          <select
            id="income-day-select"
            value={selectedDay}
            onChange={(event) => setSelectedDay(event.target.value)}
            disabled={!dayOptions.length}
          >
            {!dayOptions.length && <option value="">No Day</option>}
            {dayOptions.map((dayValue) => (
              <option key={dayValue} value={dayValue}>
                Day {dayValue}
              </option>
            ))}
          </select>
        </div>

        <div className="team-reward-control-item">
          <label htmlFor="income-reward-level-select">Reward Level</label>
          <select
            id="income-reward-level-select"
            value={selectedRewardLevel}
            onChange={(event) => setSelectedRewardLevel(event.target.value)}
          >
            {rewardLevels.map((levelItem) => (
              <option key={levelItem.value} value={levelItem.value}>
                {levelItem.label}
              </option>
            ))}
          </select>
        </div>

        <div className="team-reward-control-item">
          <label>Current Day</label>
          <div className="team-current-day-card">
            <h4 className="team-current-day-card-value">{currentDay || "-"}</h4>
          </div>
        </div>
      </div>

      {isRewardLoading && <p className="team-loading">Loading ROI reward...</p>}
      {!isRewardLoading && rewardError && <p className="team-loading">{rewardError}</p>}

      <div className="withdrawal-grid team-reward-grid">
        {renderRewardCard(
          `Day ${resolvedDay} ROI (Level ${resolvedLevel})`,
          resolvedReward,
        )}
        {renderRewardCard(`Level ${resolvedLevel} Status`, resolvedStatus)}
        {renderRewardCard("Day Start", resolvedDayStart)}
        {renderRewardCard("Day End", resolvedDayEnd)}
      </div>
    </>
  );
};

export default LevelRoiRewardPanel;
