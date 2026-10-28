// BSC Testnet deployment recorded in ../testnet-deploy/bsc-testnet-deployment.json.
export const TESTNET_CHAIN_ID = 97;
export const TESTNET_ADDRESSES = Object.freeze({
  token: "0xb602A2B700ba8bF788F06cC461EC8Fb1635e244D",
  registry: "0x81482D09896d43f171B54Adf0dd48FD7eEE23411",
  manager: "0x7f885a268CEE82bFd4922F05326eF1B2475Ed8c0",
  incomeReadyLens: "0x692a2258A3d1e4077AC5B02baeE21B69Bd1A0e46",
  ledger: "0x27280212A450D97d43812C0cbd70F56D6bEec60E",
  flushLedger: "0x6417B44827933F8b19767F723cc2596601e9Ce01",
  dao: "0x474d31f302BFbc46263c7B60Ac94e21a4B2cFa8F",
});

export const TESTNET_NETWORK = {
  chainId: "0x61",
  chainName: "BNB Smart Chain Testnet",
  nativeCurrency: { name: "Test BNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: ["https://bsc-testnet-rpc.publicnode.com"],
  blockExplorerUrls: ["https://testnet.bscscan.com"],
};
