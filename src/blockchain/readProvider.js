import { ethers } from "ethers";
import { BSC_MAINNET } from "./bscMainnetConfig";

const WALLET_SESSION_KEY = "btf_connected_wallet";

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

const bscReadProvider = new ethers.FallbackProvider([
  { provider: makeReadProvider(BSC_MAINNET.rpcUrls[1]), priority: 1, stallTimeout: 1_200, weight: 1 },
  { provider: makeReadProvider(BSC_MAINNET.rpcUrls[0]), priority: 2, stallTimeout: 2_000, weight: 1 },
// The fallback wrapper must be pinned too. Without this second argument it
// auto-detects its network; a mobile wallet/RPC transition can make it cache
// chain 1 briefly and then reject the correct BSC (56) reply.
], BSC_MAINNET.chainId, { quorum: 1 });

export const createBscReadProvider = () => bscReadProvider;
