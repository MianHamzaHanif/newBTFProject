import { ethers } from "ethers";
import { BSC_MAINNET } from "./bscMainnetConfig";

const WALLET_SESSION_KEY = "btf_connected_wallet";

// On mobile browsers some public BSC RPC requests are dropped even though the
// same endpoints answer from a server. Vercel's same-origin read-only proxy
// avoids that browser transport failure; public endpoints remain fallbacks
// for local development and any proxy outage.
export const getBscReadRpcUrls = () => {
  const hostname = typeof window === "undefined" ? "" : window.location.hostname.toLowerCase();
  // btf.marketing is a static Hostinger site, so its `/api` route serves the
  // SPA HTML rather than JSON-RPC. Route all browser reads through the live
  // Vercel read-only function there; Vercel deployments remain same-origin.
  const proxy = typeof window === "undefined"
    ? ""
    : hostname === "btf.marketing" || hostname === "www.btf.marketing"
      ? "https://new-btf-project.vercel.app/api/bsc-rpc"
      : `${window.location.origin}/api/bsc-rpc`;
  return [proxy, BSC_MAINNET.rpcUrls[1], BSC_MAINNET.rpcUrls[0]].filter(Boolean);
};

export const rememberWalletAddress = (address) => {
  if (typeof window !== "undefined" && ethers.isAddress(address || "")) {
    window.sessionStorage.setItem(WALLET_SESSION_KEY, address);
  }
};

export const clearRememberedWalletAddress = () => {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(WALLET_SESSION_KEY);
};

// Trust Wallet can temporarily return an empty eth_accounts response after a
// route change. The signed-in address is retained only for this browser tab.
export const getReadWalletAddress = async () => {
  try {
    const accounts = await window.ethereum?.request({ method: "eth_accounts" });
    const address = accounts?.[0] || "";
    if (ethers.isAddress(address)) {
      rememberWalletAddress(address);
      return address;
    }
  } catch {
    // Use the last connected address below.
  }
  const saved = typeof window === "undefined" ? "" : window.sessionStorage.getItem(WALLET_SESSION_KEY) || "";
  return ethers.isAddress(saved) ? saved : "";
};

// Read-only blockchain calls must not use the injected wallet RPC. Some
// mobile/Vercel browsers intermittently receive no HTTP response from the
// official dataseed endpoint, which ethers reports as "missing response for
// request". Use PublicNode first and fail over automatically to dataseed.
const makeReadProvider = (url) => {
  const request = new ethers.FetchRequest(url);
  request.timeout = 20_000;
  return new ethers.JsonRpcProvider(request, BSC_MAINNET.chainId, {
    staticNetwork: true,
    // Individual calls are more reliable through mobile networks than a
    // large JSON-RPC batch for dashboard histories.
    batchMaxCount: 1,
    batchStallTime: 0,
  });
};

const bscReadProvider = new ethers.FallbackProvider(getBscReadRpcUrls().map((url, index) => ({
  provider: makeReadProvider(url),
  priority: index + 1,
  stallTimeout: index === 0 ? 3_000 : 1_500,
  weight: 1,
})), BSC_MAINNET.chainId, { quorum: 1 });

export const createBscReadProvider = () => bscReadProvider;
