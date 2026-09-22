import { ethers } from "ethers";
import { BSC_TESTNET } from "./bscTestnetConfig";

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

// Read-only blockchain calls must not use the injected wallet RPC. A single
// shared provider lets ethers batch calls from dashboard cards into one RPC
// request instead of opening a new provider for every component refresh.
const readRequest = new ethers.FetchRequest(BSC_TESTNET.rpcUrls[1]);
readRequest.timeout = 12_000;

const bscReadProvider = new ethers.JsonRpcProvider(
  readRequest,
  BSC_TESTNET.chainId,
  {
    staticNetwork: true,
    batchMaxCount: 100,
    batchStallTime: 0,
  },
);

export const createBscReadProvider = () => bscReadProvider;
