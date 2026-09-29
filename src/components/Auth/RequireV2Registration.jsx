import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { ethers } from "ethers";
import { BSC_MAINNET } from "../../blockchain/bscMainnetConfig";
import { readRegistration, readV1Registration } from "../../blockchain/registrationReader";
import { canAccessDashboardWithoutRegistration } from "../../blockchain/migrationAccess";

// A member may still be V1-only while migration is underway. Permit access
// when either Registry recognises the connected wallet.
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
          BigInt(chainId) !== BigInt(BSC_MAINNET.chainIdHex) ||
          !ethers.isAddress(wallet)
        ) {
          if (!cancelled) setStatus("denied");
          return;
        }

        const [v2Result, v1Result, accessResult] = await Promise.allSettled([
          readRegistration("users", wallet),
          readV1Registration("users", wallet),
          canAccessDashboardWithoutRegistration(wallet),
        ]);
        const v2User = v2Result.status === "fulfilled" ? v2Result.value : null;
        const v1User = v1Result.status === "fulfilled" ? v1Result.value : null;
        const hasDashboardAccess = accessResult.status === "fulfilled" && accessResult.value;
        const v2Exists = Boolean(v2User?.exists ?? v2User?.[8] ?? false);
        const v1Exists = Boolean(v1User?.exists ?? v1User?.[8] ?? false)
          || Number(v1User?.id ?? v1User?.[0] ?? 0) > 0;
        if (!cancelled) setStatus(v1Exists || v2Exists || hasDashboardAccess ? "allowed" : "denied");
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
    return <div className="page-container">Checking V1/V2 registration...</div>;
  }

  return status === "allowed" ? <Outlet /> : <Navigate to="/login" replace />;
}
