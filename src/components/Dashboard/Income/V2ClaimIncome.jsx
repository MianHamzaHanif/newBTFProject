import { TableCell } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2PackageManagerABI from "../../../blockchain/v2PackageManagerABI";
import V2IncomeLedgerABI from "../../../blockchain/v2IncomeLedgerABI";
import TestUsdtABI from "../../../blockchain/testUsdtABI";
import {
  HasTestUsdtFaucet,
  IncomeReadyLensAddress,
  PackageManagerAddress,
  TokenAddress,
  V2LedgerAddress,
  V3ActionsEnabled
} from "../../../blockchain/address";
import { WALLET_ADD_CHAIN_PARAMS } from "../../../blockchain/bscMainnetConfig";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import "../styles/style.css";

const CLAIMS_PAUSED = !V3ActionsEnabled;
const MIGRATION_PAUSED_MESSAGE = "Claiming is temporarily unavailable while system migration is under construction. Please check back soon.";
// P1 was marked achieved for this migrated account but its V1 paid-cycle
// baseline was not written to V3. Prevent the V3 lens preview from exposing
// its already-claimed 150 as a second claim in the UI.
const V1_POWER_BASELINE_OVERRIDE_USER = "0x340175da3dac792f372f8e7eb7edf47cadb96c4c";

const claimActions = [
  { method: "claimDirectIncome", incomeType: 0, label: "Direct Income" },
  { method: "claimSelfRoi", incomeType: 1, label: "Self ROI" },
  { method: "claimLevelRoi", incomeType: 2, label: "Level ROI" },
  { method: "claimPowerIncome", incomeType: 3, label: "Power Income" },
  { method: "claimRewardIncome", incomeType: 4, label: "Reward Income" }
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

// Mobile wallets occasionally fail while ethers' BrowserProvider polls a
// receipt, reporting the opaque "could not coalesce error" even though the
// claim call itself is valid. Submit through the wallet's native JSON-RPC and
// poll that same wallet RPC, matching the reliable package-buy flow.
async function waitForWalletReceipt(transactionHash, timeoutMs = 90_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const receipt = await window.ethereum.request({
      method: "eth_getTransactionReceipt",
      params: [transactionHash],
    });
    if (receipt) return receipt;
    await new Promise((resolve) => window.setTimeout(resolve, 1_500));
  }
  return null;
}

export default function V2ClaimIncome() {
  const [rows, setRows] = useState([]);
  const [pendingMethod, setPendingMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadClaimData = useCallback(async () => {
    if (!ethers.isAddress(PackageManagerAddress)) {
      setRows([]);
      setMessage("V3 PackageManager address is not configured yet.");
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
        ["function getIncomeReady(address user,uint8 incomeType) view returns (uint256)"],
        createBscReadProvider()
      );
      const incomeLens = new ethers.Contract(IncomeReadyLensAddress, V2PackageManagerABI, createBscReadProvider());
      const readProvider = createBscReadProvider();
      const ledger = new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, readProvider);
      const nextRows = await Promise.all(
        claimActions.map(async (action, index) => {
          let currentAmount = 0n;
          let claimedAmount = 0n;

          try {
            // Strictly V3-ready income. V1/V2 checkpoint previews are not
            // combined here; users claim only against the V3 deployment.
            currentAmount = await incomeLens.getIncomeReady(wallet, action.incomeType);
          } catch {
            currentAmount = 0n;
          }
          if (
            action.incomeType === 3
            && wallet.toLowerCase() === V1_POWER_BASELINE_OVERRIDE_USER
          ) {
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
            readyAmount: currentAmount,
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
    if (CLAIMS_PAUSED) {
      setMessage(MIGRATION_PAUSED_MESSAGE);
      return;
    }
    const row = rows.find((entry) => entry.method === method);
    if (!row || BigInt(row.readyAmount ?? 0n) === 0n) {
      setMessage(`No ${row?.incomeType || "income"} is ready to claim.`);
      return;
    }
    if (!window.ethereum) {
      setMessage("MetaMask or Trust Wallet is not available.");
      return;
    }

    try {
      setPendingMethod(method);
      setMessage("Please confirm the claim transaction in your wallet.");
      let accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureBscMainnet();
      accounts = await window.ethereum.request({ method: "eth_accounts" });
      const sender = accounts?.[0] || "";
      if (!ethers.isAddress(sender)) throw new Error("Wallet account not available.");

      const managerInterface = new ethers.Interface(V2PackageManagerABI);
      const transactionHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{
          from: sender,
          to: PackageManagerAddress,
          data: managerInterface.encodeFunctionData(method),
        }],
      });
      setMessage("Claim submitted. Waiting for confirmation...");
      const receipt = await waitForWalletReceipt(transactionHash);
      if (!receipt || Number(receipt.status) !== 1) {
        setMessage("Claim is pending or failed. Check your wallet Activity, then refresh amounts.");
        return;
      }
      setMessage("Income claimed successfully and credited to the V3 ledger.");
      await loadClaimData();
      window.dispatchEvent(new Event("btf:v3-data-changed"));
    } catch (error) {
      const rawMessage = error?.shortMessage || error?.reason || error?.message || "";
      setMessage(
        rawMessage.toLowerCase().includes("could not coalesce error")
          ? "Wallet RPC rejected the claim request. Reconnect the wallet on BSC Mainnet and try again."
          : rawMessage || "Claim failed.",
      );
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
      <h1>Claim Income</h1>
      <div className="table-wrapper">
        <div className="table-card">
          {CLAIMS_PAUSED && <p className="team-loading">{MIGRATION_PAUSED_MESSAGE}</p>}
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
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={CLAIMS_PAUSED || Boolean(pendingMethod) || BigInt(row.readyAmount ?? 0n) === 0n}
                    onClick={() => claim(row.method)}
                  >
                    {CLAIMS_PAUSED ? "Claim Paused" : pendingMethod === row.method ? "Claiming..." : "Claim"}
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
