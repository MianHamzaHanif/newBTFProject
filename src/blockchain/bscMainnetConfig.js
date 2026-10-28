// This copied UI targets the new BSC Testnet deployment only.
export const BSC_MAINNET = {
  chainId: 97,
  chainIdHex: "0x61",
  chainName: "BNB Smart Chain Testnet",
  rpcUrls: [
    "https://bsc-testnet-rpc.publicnode.com",
    "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
  ],
  blockExplorerUrls: ["https://testnet.bscscan.com"],
  nativeCurrency: {
    name: "Test BNB",
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
