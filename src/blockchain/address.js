// BSC Testnet V2 values. The Hardhat deployment script writes these into
// .env.local after a successful deployment. The fallbacks keep the deployed
// Vercel UI functional if its build-time VITE variables are missing or stale.
export const TokenAddress = import.meta.env.VITE_BTF_TESTNET_USDT_ADDRESS || "0xb602A2B700ba8bF788F06cC461EC8Fb1635e244D";
export const ReferralNetworkAddress = import.meta.env.VITE_BTF_V2_REGISTRY_ADDRESS || "0xCd05D4ef51C8cC97A171fbDd3C9eEe73FcDC4061";
export const PackageManagerAddress = import.meta.env.VITE_BTF_V2_PACKAGE_MANAGER_ADDRESS || "0x069b3707b9e7eCcB4F40aFcBd81D030cF990ADbe";
export const V2DeploymentBlock = import.meta.env.VITE_BTF_V2_DEPLOYMENT_BLOCK || "132935424";
export const V2LedgerAddress = import.meta.env.VITE_BTF_V2_LEDGER_ADDRESS || "0x052e4F45300a54dbdC24B3588451389d8be772AA";
export const V2FlushLedgerAddress = import.meta.env.VITE_BTF_V2_FLUSH_LEDGER_ADDRESS || "0x588293b398d1fB7a9dBFD95e6af8d082b4f4b717";
export const HasTestUsdtFaucet = import.meta.env.VITE_BTF_TEST_USDT_FAUCET === "true";

// These old modules do not exist in V2 yet. They remain blank deliberately.
export const PackageManagerLensAddress = "";
export const RouterAddress = "";
export const StakeTokenAddress = "";
