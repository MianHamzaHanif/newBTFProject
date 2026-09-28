// BSC Testnet V2 values. The Hardhat deployment script writes these into
// .env.local after a successful deployment. The fallbacks keep the deployed
// Vercel UI functional if its build-time VITE variables are missing or stale.
export const TokenAddress = import.meta.env.VITE_BTF_TESTNET_USDT_ADDRESS || "0xb602A2B700ba8bF788F06cC461EC8Fb1635e244D";
export const ReferralNetworkAddress = import.meta.env.VITE_BTF_V2_REGISTRY_ADDRESS || "0xDD6031b5cb7ca87a400CC7E9165D99659B449280";
export const PackageManagerAddress = import.meta.env.VITE_BTF_V2_PACKAGE_MANAGER_ADDRESS || "0x6226F0160040D1718DAf489398674971a0dE8413";
export const V2DeploymentBlock = import.meta.env.VITE_BTF_V2_DEPLOYMENT_BLOCK || "133642675";
export const V2LedgerAddress = import.meta.env.VITE_BTF_V2_LEDGER_ADDRESS || "0x9B6E6E8Ac455695eCad0094b3496b805D25748b3";
export const V2FlushLedgerAddress = import.meta.env.VITE_BTF_V2_FLUSH_LEDGER_ADDRESS || "0x3D8Fa6824b2682ac5EA034C38B916b6a8cE53c93";
export const HasTestUsdtFaucet = import.meta.env.VITE_BTF_TEST_USDT_FAUCET === "true";

// These old modules do not exist in V2 yet. They remain blank deliberately.
export const PackageManagerLensAddress = "";
export const RouterAddress = "";
export const StakeTokenAddress = "";
