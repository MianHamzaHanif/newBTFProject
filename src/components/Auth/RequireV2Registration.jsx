import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { ethers } from "ethers";
import { BSC_TESTNET } from "../../blockchain/bscTestnetConfig";
import { readRegistration } from "../../blockchain/registrationReader";

// Dashboard routes are protected by the V2 Registry itself. A connected wallet
// is not enough: `users(wallet).exists` must be true on BSC Testnet.
export default function RequireV2Registration() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    const checkRegistration = async () => {
      try {
        if (!window.ethereum) throw new Error("Wallet not found");

        const [chainId, accounts] = await Promise.all([
          window.ethereum.request({ method: "eth_chainId" }),
          window.ethereum.request({ method: "eth_accounts" }),
        ]);
        const wallet = accounts?.[0] || "";

        if (
          BigInt(chainId) !== BigInt(BSC_TESTNET.chainIdHex) ||
          !ethers.isAddress(wallet)
        ) {
          if (!cancelled) setStatus("denied");
          return;
        }

        const user = await readRegistration("users", wallet);
        const exists = Boolean(user?.exists ?? user?.[8] ?? false);
        if (!cancelled) setStatus(exists ? "allowed" : "denied");
      } catch {
        if (!cancelled) setStatus("denied");
      }
    };

    checkRegistration();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "checking") {
    return <div className="page-container">Checking V2 registration...</div>;
  }

  return status === "allowed" ? <Outlet /> : <Navigate to="/login" replace />;
}
