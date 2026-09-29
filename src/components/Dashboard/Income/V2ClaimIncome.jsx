import { TableCell } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2PackageManagerABI from "../../../blockchain/v2PackageManagerABI";
import V2IncomeLedgerABI from "../../../blockchain/v2IncomeLedgerABI";
import TestUsdtABI from "../../../blockchain/testUsdtABI";
import {
  HasTestUsdtFaucet,
  PackageManagerAddress,
  TokenAddress,
  V2LedgerAddress,
  V2LegacyRankCheckpointAddress
} from "../../../blockchain/address";
import { WALLET_ADD_CHAIN_PARAMS } from "../../../blockchain/bscMainnetConfig";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import "../styles/style.css";

const claimActions = [
  { method: "claimDirectIncome", incomeType: 0, label: "Direct Income" },
  { method: "claimSelfRoi", incomeType: 1, label: "Self ROI" },
  { method: "claimLevelRoi", incomeType: 2, label: "Level ROI" },
  { method: "claimPowerIncome", incomeType: 3, label: "Power Income" },
  { method: "claimRewardIncome", incomeType: 4, label: "Reward Income" }
];
const RANK_CHECKPOINT_READ_ABI = [
  "function previewPowerClaimable(address user) view returns(uint256 level,uint256 amount)",
  "function previewRewardClaimable(address user,uint256 index) view returns(uint256 amount)"
];

const formatAmount = (amount) => {
  try {
    return Number(ethers.formatEther(amount || 0n)).toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    });
  } catch {
    return "0.0000";
  }
};

async function ensureBscMainnet() {
  const currentChain = await window.ethereum.request({ method: "eth_chainId" });
  if (BigInt(currentChain) === BigInt(WALLET_ADD_CHAIN_PARAMS.chainId)) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: WALLET_ADD_CHAIN_PARAMS.chainId }]
    });
  } catch (error) {
    if (error?.code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [WALLET_ADD_CHAIN_PARAMS]
    });
  }
}

export default function V2ClaimIncome() {
  const [rows, setRows] = useState([]);
  const [pendingMethod, setPendingMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadClaimData = useCallback(async () => {
    if (!ethers.isAddress(PackageManagerAddress)) {
      setRows([]);
      setMessage("V2 PackageManager address is not configured yet.");
      return;
    }

    const wallet = await getReadWalletAddress();
    if (!ethers.isAddress(wallet)) {
      setRows([]);
      setMessage("Please connect your wallet.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      const packageManager = new ethers.Contract(
        PackageManagerAddress,
        V2PackageManagerABI,
        createBscReadProvider()
      );
      const incomeLens = new ethers.Contract(
        await packageManager.incomeReadyLens(),
        V2PackageManagerABI,
        createBscReadProvider()
      );
      const readProvider = createBscReadProvider();
      const ledger = new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, readProvider);
      const checkpoint = new ethers.Contract(V2LegacyRankCheckpointAddress, RANK_CHECKPOINT_READ_ABI, readProvider);
      const nextRows = await Promise.all(
        claimActions.map(async (action, index) => {
          let currentAmount = 0n;
          let claimedAmount = 0n;

          try {
            // Raw ready income is displayed independently. The shared package
            // cap is enforced only when the user presses Claim.
            currentAmount = await incomeLens.getIncomeReady(wallet, action.incomeType);

            // The legacy checkpoint keeps a verified V1 remainder until the
            // user claims Power. Preview is calculated in the checkpoint from
            // the current block, including any due 10-day installment.
            if (action.incomeType === 3) {
              try {
                const [, legacyReady] = await checkpoint.previewPowerClaimable(wallet);
                currentAmount += legacyReady;
              } catch {
                // A prior deployment may not yet contain the optional
                // checkpoint preview method. Keep normal V2 income visible.
              }
            }
            if (action.incomeType === 4) {
              try {
                const legacyRewards = await Promise.all(
                  Array.from({ length: 12 }, (_, offset) => checkpoint.previewRewardClaimable(wallet, offset + 1))
                );
                currentAmount += legacyRewards.reduce((total, amount) => total + BigInt(amount), 0n);
              } catch {
                // Keep normal V2 Reward preview available until the updated
                // legacy checkpoint is deployed.
              }
            }

            // Show the raw accrued amount for every income type. The shared
            // package cap is intentionally applied only when Claim is sent;
            // therefore a visible Power/Reward amount can still Flush if the
            // user has no remaining package-income capacity.
          } catch {
            currentAmount = 0n;
          }

          try {
            const length = Number(
              await ledger.getUserIncomeHistoryLengthByType(wallet, action.incomeType)
            );
            for (let historyIndex = 0; historyIndex < length; historyIndex += 1) {
              const record = await ledger.getUserIncomeHistoryAtByType(
                wallet,
                action.incomeType,
                historyIndex
              );
              claimedAmount += record.amount;
            }
          } catch {
            claimedAmount = 0n;
          }

          return {
            sno: index + 1,
            incomeType: action.label,
            current: formatAmount(currentAmount),
            claimed: formatAmount(claimedAmount),
            method: action.method
          };
        })
      );
      setRows(nextRows);
    } catch (error) {
      setRows([]);
      setMessage(error?.shortMessage || "Unable to load claim data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClaimData();
    const handleV2DataChanged = () => loadClaimData();
    window.addEventListener("btf:v2-data-changed", handleV2DataChanged);
    return () => window.removeEventListener("btf:v2-data-changed", handleV2DataChanged);
  }, [loadClaimData]);

  const claim = async (method) => {
    if (!window.ethereum) {
      setMessage("MetaMask or Trust Wallet is not available.");
      return;
    }

    try {
      setPendingMethod(method);
      setMessage("Please confirm the claim transaction in your wallet.");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureBscMainnet();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const packageManager = new ethers.Contract(PackageManagerAddress, V2PackageManagerABI, signer);
      const tx = await packageManager[method]();
      await tx.wait();
      setMessage("Income claimed successfully and credited to the V2 ledger.");
      await loadClaimData();
      window.dispatchEvent(new Event("btf:v2-data-changed"));
    } catch (error) {
      setMessage(error?.shortMessage || error?.reason || error?.message || "Claim failed.");
    } finally {
      setPendingMethod("");
    }
  };

  const getTestUsdt = async () => {
    if (!window.ethereum) {
      setMessage("MetaMask or Trust Wallet is not available.");
      return;
    }

    try {
      setPendingMethod("faucet");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureBscMainnet();
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const tx = await new ethers.Contract(TokenAddress, TestUsdtABI, signer).faucet();

      setMessage("Please confirm the transaction in your wallet.");
      await tx.wait();
      setMessage("10,000 tUSDT received for testing.");
      await loadClaimData();
    } catch (error) {
      setMessage(error?.shortMessage || error?.reason || error?.message || "Transaction failed.");
    } finally {
      setPendingMethod("");
    }
  };

  const columns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "incomeType", label: "Income Type", sortable: true },
    { id: "current", label: "Income Ready", sortable: true },
    { id: "claimed", label: "Already Claimed (All-Time)", sortable: true },
    { id: "action", label: "Action", sortable: false }
  ];

  return (
    <div className="page-container">
      <h1>Claim V2 Income</h1>
      <div className="table-wrapper">
        <div className="table-card">
          <button className="btn btn-outline-primary mb-3" onClick={loadClaimData} disabled={loading || Boolean(pendingMethod)}>
            {loading ? "Loading..." : "Refresh Amounts"}
          </button>
          {message && <p className="team-loading">{message}</p>}
          <CustomTable
            columns={columns}
            rows={rows}
            renderRow={(row) => (
              <>
                <TableCell align="center">{row.sno}</TableCell>
                <TableCell align="center">{row.incomeType}</TableCell>
                <TableCell align="center">{row.current}</TableCell>
                <TableCell align="center">{row.claimed}</TableCell>
                <TableCell align="center">
                  <button className="btn btn-primary btn-sm" disabled={Boolean(pendingMethod)} onClick={() => claim(row.method)}>
                    {pendingMethod === row.method ? "Claiming..." : "Claim"}
                  </button>
                </TableCell>
              </>
            )}
          />
          <div className="d-flex flex-wrap gap-2 mt-3">
            {HasTestUsdtFaucet && (
              <button className="btn btn-outline-primary" disabled={Boolean(pendingMethod)} onClick={getTestUsdt}>
                {pendingMethod === "faucet" ? "Getting tUSDT..." : "Get 10,000 tUSDT"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
