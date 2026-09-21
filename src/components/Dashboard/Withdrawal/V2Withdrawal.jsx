import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { TableCell } from "@mui/material";
import V2IncomeLedgerABI from "../../../blockchain/v2IncomeLedgerABI";
import { V2LedgerAddress } from "../../../blockchain/address";
import { WALLET_ADD_CHAIN_PARAMS } from "../../../blockchain/bscTestnetConfig";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import CustomTable from "../CommonComponents/CustomTable";

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

const ensureBscTestnet = async () => {
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
  const [pending, setPending] = useState(0n);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0n);
  const [minimumWithdraw, setMinimumWithdraw] = useState(10n ** 19n);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");
      const user = await getReadWalletAddress();
      if (!user || !ethers.isAddress(user)) throw new Error("Please connect your wallet.");
      if (!ethers.isAddress(V2LedgerAddress)) throw new Error("V2 ledger address is not configured.");

      const ledger = new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, createBscReadProvider());
      const [balance, minimum] = await Promise.all([
        ledger.balanceOf(user),
        ledger.minWithdrawAmount(),
      ]);
      let withdrawn = 0n;

      try {
        const length = Number(await ledger.getUserWithdrawHistoryLength(user));
        const entries = await Promise.all(
          Array.from({ length }, (_, index) => ledger.getUserWithdrawHistoryAt(user, index)),
        );
        withdrawn = entries.reduce((sum, item) => sum + (item.amount ?? item[0] ?? 0n), 0n);
        setHistory(entries.reverse());
      } catch {
        // The history getter is available in the new V2 deployment. Balance remains usable.
        setHistory([]);
      }

      setPending(balance);
      setMinimumWithdraw(minimum);
      setTotalWithdrawn(withdrawn);
    } catch (error) {
      setPending(0n);
      setMinimumWithdraw(10n ** 19n);
      setTotalWithdrawn(0n);
      setHistory([]);
      setMessage(error?.shortMessage || error?.message || "Could not load V2 withdrawal data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const withdraw = async () => {
    if (!window.ethereum) {
      setMessage("MetaMask or Trust Wallet is not available.");
      return;
    }
    if (pending <= 0n) {
      setMessage("No V2 income is pending for withdrawal.");
      return;
    }
    if (pending < minimumWithdraw) {
      setMessage(`Minimum V2 withdrawal is ${formatUsdt(minimumWithdraw)} USDT.`);
      return;
    }

    try {
      setWithdrawing(true);
      setMessage("Confirm V2 withdrawal in your wallet.");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureBscTestnet();
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const tx = await new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, signer).withdrawAll();
      await tx.wait();
      setMessage("V2 income withdrawn successfully.");
      await load();
    } catch (error) {
      setMessage(error?.shortMessage || error?.reason || error?.message || "V2 withdrawal failed.");
    } finally {
      setWithdrawing(false);
    }
  };

  const historyColumns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "amount", label: "Withdrawn Amount", sortable: true },
    { id: "time", label: "Withdraw Time", sortable: true },
  ];

  const historyRows = history.map((item, index) => ({
    sno: index + 1,
    amount: formatUsdt(item.amount ?? item[0] ?? 0n),
    time: formatTime(item.timestamp ?? item[1] ?? 0n),
  }));

  return (
    <>
      <div className="table-card" style={{ marginTop: "24px" }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">V2 Withdrawal Total</h2>
        <button className="btn btn-outline-primary" onClick={load} disabled={loading || withdrawing}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      <div className="withdrawal-grid">
        <div className="withdrawal-card">
          <p className="withdrawal-card-title">V2 Pending Withdrawal</p>
          <h4 className="withdrawal-card-value">{formatUsdt(pending)} USDT</h4>
        </div>
        <div className="withdrawal-card">
          <p className="withdrawal-card-title">Total V2 Withdrawn</p>
          <h4 className="withdrawal-card-value">{formatUsdt(totalWithdrawn)} USDT</h4>
        </div>
        <div className="withdrawal-card">
          <p className="withdrawal-card-title">Minimum V2 Withdrawal</p>
          <h4 className="withdrawal-card-value">{formatUsdt(minimumWithdraw)} USDT</h4>
        </div>
      </div>
      <div className="withdraw-action-wrap">
        <button className="custom-button withdraw-btn" onClick={withdraw} disabled={withdrawing || pending < minimumWithdraw}>
          {withdrawing ? "Withdrawing..." : "Withdraw V2"}
        </button>
        {message ? <p className="team-loading withdraw-status">{message}</p> : null}
      </div>
      </div>

      <div className="table-card" style={{ marginTop: "24px" }}>
        <h2 className="mb-3">V2 Withdrawal History</h2>
        <CustomTable
          columns={historyColumns}
          rows={historyRows}
          renderRow={(row) => (
            <>
              <TableCell align="center">{row.sno}</TableCell>
              <TableCell align="center">{row.amount} USDT</TableCell>
              <TableCell align="center">{row.time}</TableCell>
            </>
          )}
        />
      </div>
    </>
  );
}
