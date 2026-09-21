export const BSC_TESTNET = {
  chainId: 97,
  chainIdHex: "0x61",
  chainName: "BNB Smart Chain Testnet",
  rpcUrls: [
    "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
    "https://bsc-testnet-rpc.publicnode.com"
  ],
  blockExplorerUrls: ["https://testnet.bscscan.com"],
  nativeCurrency: {
    name: "tBNB",
    symbol: "tBNB",
    decimals: 18
  }
};

export const WALLET_ADD_CHAIN_PARAMS = {
  chainId: BSC_TESTNET.chainIdHex,
  chainName: BSC_TESTNET.chainName,
  nativeCurrency: BSC_TESTNET.nativeCurrency,
  rpcUrls: BSC_TESTNET.rpcUrls,
  blockExplorerUrls: BSC_TESTNET.blockExplorerUrls
};
