// BNB Smart Chain Mainnet network configuration used by all V2 reads and
// wallet transactions.
export const BSC_MAINNET = {
  chainId: 56,
  chainIdHex: "0x38",
  chainName: "BNB Smart Chain",
  rpcUrls: [
    "https://bsc-dataseed.bnbchain.org",
    "https://bsc-rpc.publicnode.com",
  ],
  blockExplorerUrls: ["https://bscscan.com"],
  nativeCurrency: {
    name: "BNB",
    symbol: "BNB",
    decimals: 18,
  },
};

export const WALLET_ADD_CHAIN_PARAMS = {
  chainId: BSC_MAINNET.chainIdHex,
  chainName: BSC_MAINNET.chainName,
  nativeCurrency: BSC_MAINNET.nativeCurrency,
  rpcUrls: BSC_MAINNET.rpcUrls,
  blockExplorerUrls: BSC_MAINNET.blockExplorerUrls,
};
