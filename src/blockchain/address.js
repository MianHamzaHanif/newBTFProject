// BSC Testnet V2 values. The Hardhat deployment script writes these into
// .env.local after a successful deployment. The fallbacks keep the deployed
// Vercel UI functional if its build-time VITE variables are missing or stale.
export const TokenAddress = import.meta.env.VITE_BTF_TESTNET_USDT_ADDRESS || "0xb602A2B700ba8bF788F06cC461EC8Fb1635e244D";
export const ReferralNetworkAddress = import.meta.env.VITE_BTF_V2_REGISTRY_ADDRESS || "0xC9aFA23BAB7f1d8f999BB6503f72D858d3f89Ac6";
export const PackageManagerAddress = import.meta.env.VITE_BTF_V2_PACKAGE_MANAGER_ADDRESS || "0xbb56cddD1B9c6b7f0e90D4D230B47ea6615e37b9";
export const V2DeploymentBlock = import.meta.env.VITE_BTF_V2_DEPLOYMENT_BLOCK || "132506433";
export const V2LedgerAddress = import.meta.env.VITE_BTF_V2_LEDGER_ADDRESS || "0xAF17Ba7e3ab94F36042Bc429346D57850eF5B2f7";
export const V2FlushLedgerAddress = import.meta.env.VITE_BTF_V2_FLUSH_LEDGER_ADDRESS || "0x1228d204321F319a654999982f097277314876A0";
export const HasTestUsdtFaucet = import.meta.env.VITE_BTF_TEST_USDT_FAUCET === "true";

// These old modules do not exist in V2 yet. They remain blank deliberately.
export const PackageManagerLensAddress = "";
export const RouterAddress = "";
export const StakeTokenAddress = "";
