import { TableCell } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import PackageManagerABI from "../../../blockchain/packageMangerABI.json";
import PackageManagerLensABI from "../../../blockchain/packageManagerLensABI.json";
import { PackageManagerAddress, PackageManagerLensAddress } from "../../../blockchain/address";
import { createBscReadProvider } from "../../../blockchain/readProvider";
import { getReadWalletAddress } from "../../../blockchain/readProvider";
import "../styles/style.css";

export const Lock = () => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState("");
  const [nextUnlock, setNextUnlock] = useState({
    nextUnlockTs: 0,
    secondsLeft: 0,
    pendingAmount: "0.0000",
  });
  const [summary, setSummary] = useState({
    claimableNow: "0.0000",
    claimableIn90Days: "0.0000",
    directClaimable: "0.0000",
  });

  const columns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "amount", label: "Amount", sortable: true },
    { id: "claimed", label: "Claimed", sortable: true },
    { id: "unlockTime", label: "Unlock Time", sortable: true },
  ];

  const formatEther4 = (value) => {
    try {
      const etherValue = ethers.formatEther(value ?? 0n);
      const [whole, fraction = ""] = etherValue.split(".");
      return `${whole}.${(fraction + "0000").slice(0, 4)}`;
    } catch {
      return "0.0000";
    }
  };

  const formatTime = (value) => {
    const ts = Number(value);
    if (!ts) {
      return "-";
    }
    return new Date(ts * 1000).toLocaleString();
  };

  const formatSeconds = (seconds) => {
    if (!seconds || seconds <= 0) {
      return "Unlocked";
    }
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${d}d ${h}h ${m}m ${s}s`;
  };

  const fetchLocks = useCallback(async () => {
    if (!window.ethereum) {
      setRows([]);
      return;
    }

    try {
      setIsLoading(true);
      const walletAddress = await getReadWalletAddress();

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        setRows([]);
        return;
      }

      const provider = createBscReadProvider();
      const packageManagerLens = new ethers.Contract(
        PackageManagerLensAddress,
        PackageManagerLensABI,
        provider,
      );

        const lengthRaw = await packageManagerLens.getUserLocksLength(walletAddress);
        const length = Number(lengthRaw);
        const nextRows = [];
        const nowTs = Math.floor(Date.now() / 1000);
        const ninetyDaysTs = nowTs + 90 * 24 * 60 * 60;
        let claimableNowRaw = 0n;
        let claimableIn90DaysRaw = 0n;
        let nextUnlockTs = 0;
        let nextPendingAmountRaw = 0n;

        const directClaimableRaw = await packageManagerLens.getUserClaimable(
          walletAddress,
        );

        for (let index = length - 1; index >= 0; index -= 1) {
          const lock = await packageManagerLens.getUserLockAt(walletAddress, index);
          const amountRaw = lock?.amount ?? lock?.[0] ?? 0n;
          const claimedRaw = lock?.claimed ?? lock?.[1] ?? 0n;
          const unlockTimeRaw = lock?.unlockTime ?? lock?.[2] ?? 0n;
          const remainingRaw = amountRaw > claimedRaw ? amountRaw - claimedRaw : 0n;
          const unlockTs = Number(unlockTimeRaw);

          if (unlockTs <= nowTs) {
            claimableNowRaw += remainingRaw;
          }
          if (unlockTs <= ninetyDaysTs) {
            claimableIn90DaysRaw += remainingRaw;
          }

          if (
            remainingRaw > 0n &&
            unlockTs > nowTs &&
            (nextUnlockTs === 0 || unlockTs < nextUnlockTs)
          ) {
            nextUnlockTs = unlockTs;
            nextPendingAmountRaw = remainingRaw;
          }

          nextRows.push({
            sno: nextRows.length + 1,
            amount: formatEther4(amountRaw),
            claimed: formatEther4(claimedRaw),
            unlockTime: formatTime(unlockTimeRaw),
          });
        }

        setRows(nextRows);
        setNextUnlock({
          nextUnlockTs,
          secondsLeft: nextUnlockTs > nowTs ? nextUnlockTs - nowTs : 0,
          pendingAmount: formatEther4(nextPendingAmountRaw),
        });
      setSummary({
        claimableNow: formatEther4(claimableNowRaw),
        claimableIn90Days: formatEther4(claimableIn90DaysRaw),
        directClaimable: formatEther4(directClaimableRaw),
      });
    } catch {
      setRows([]);
      setNextUnlock({
        nextUnlockTs: 0,
        secondsLeft: 0,
        pendingAmount: "0.0000",
      });
      setSummary({
        claimableNow: "0.0000",
        claimableIn90Days: "0.0000",
        directClaimable: "0.0000",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocks();
  }, [fetchLocks]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNextUnlock((prev) => ({
        ...prev,
        secondsLeft: prev.secondsLeft > 0 ? prev.secondsLeft - 1 : 0,
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleClaimUserLocked = async () => {
    if (!window.ethereum) {
      setClaimStatus("MetaMask not found.");
      return;
    }

    try {
      setIsClaiming(true);
      setClaimStatus("Claiming user locked...");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const packageManager = new ethers.Contract(
        PackageManagerAddress,
        PackageManagerABI,
        signer,
      );

      const tx = await packageManager.claimUserLocked();
      await tx.wait();
      setClaimStatus("Claim successful.");
      await fetchLocks();
    } catch (error) {
      setClaimStatus(
        error?.shortMessage || error?.reason || error?.message || "Claim failed.",
      );
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="page-container">
      <h1>Lock</h1>
      <div className="table-wrapper">
        <div className="table-card">
          {isLoading && <p className="team-loading">Loading lock data...</p>}
          <div className="withdrawal-grid">
            <div className="withdrawal-card">
              <p className="withdrawal-card-title">Claimable (Unlocked Now)</p>
              <h4 className="withdrawal-card-value">{summary.claimableNow}</h4>
            </div>
            <div className="withdrawal-card">
              <p className="withdrawal-card-title">Claimable in 90 Days (User Lock)</p>
              <h4 className="withdrawal-card-value">{summary.claimableIn90Days}</h4>
            </div>
            <div className="withdrawal-card">
              <p className="withdrawal-card-title">Total Claimable</p>
              <h4 className="withdrawal-card-value">{summary.directClaimable}</h4>
            </div>
            <div className="withdrawal-card lock-time-card">
              <p className="withdrawal-card-title">Next Unlock Time Left</p>
              <h4 className="withdrawal-card-value">
                {formatSeconds(nextUnlock.secondsLeft)}
              </h4>
              <p className="withdrawal-card-title">
                Next Unlock Amount: {nextUnlock.pendingAmount}
              </p>
            </div>
          </div>
          <div className="withdraw-action-wrap">
            <button
              className="custom-button withdraw-btn"
              onClick={handleClaimUserLocked}
              disabled={isClaiming}
            >
              {isClaiming ? "Claiming..." : "Claim User Locked"}
            </button>
            {claimStatus && <p className="team-loading withdraw-status">{claimStatus}</p>}
          </div>
          <CustomTable
            columns={columns}
            rows={rows}
            renderRow={(row) => (
              <>
                <TableCell align="center">{row.sno}</TableCell>
                <TableCell align="center">{row.amount}</TableCell>
                <TableCell align="center">{row.claimed}</TableCell>
                <TableCell align="center" className="team-time-cell">
                  {row.unlockTime}
                </TableCell>
              </>
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default Lock;
