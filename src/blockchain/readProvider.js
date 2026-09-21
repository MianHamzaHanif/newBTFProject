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

// Read-only blockchain calls must not use the injected wallet RPC. Trust Wallet
// can reject or time out those calls even after the account is connected.
export const createBscReadProvider = () =>
  new ethers.JsonRpcProvider(
    BSC_TESTNET.rpcUrls[0],
    BSC_TESTNET.chainId,
    { staticNetwork: true },
  );
