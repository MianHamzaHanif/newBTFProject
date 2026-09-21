// Compatibility export for older dashboard files.  The V2 application is
// testnet-only, so every consumer of this config uses BSC Testnet (chain 97).
export const BSC_MAINNET = {
  chainId: 97,
  chainIdHex: "0x61",
  chainName: "BNB Smart Chain Testnet",
  rpcUrls: [
    "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
    "https://bsc-testnet-rpc.publicnode.com",
  ],
  blockExplorerUrls: ["https://testnet.bscscan.com"],
  nativeCurrency: {
    name: "tBNB",
    symbol: "tBNB",
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
