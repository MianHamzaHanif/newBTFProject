// BSC Testnet V2 values. The Hardhat deployment script writes these into
// .env.local after a successful deployment. The fallbacks keep the deployed
// Vercel UI functional if its build-time VITE variables are missing or stale.
export const TokenAddress = import.meta.env.VITE_BTF_TESTNET_USDT_ADDRESS || "0xb602A2B700ba8bF788F06cC461EC8Fb1635e244D";
export const ReferralNetworkAddress = import.meta.env.VITE_BTF_V2_REGISTRY_ADDRESS || "0x698B0ca5975582A60c76B13FD18Dbaa7e2cC664A";
export const PackageManagerAddress = import.meta.env.VITE_BTF_V2_PACKAGE_MANAGER_ADDRESS || "0x4329049003Aad4C382f26b4d0e6B8Ba8D05b1770";
export const V2DeploymentBlock = import.meta.env.VITE_BTF_V2_DEPLOYMENT_BLOCK || "132876775";
export const V2LedgerAddress = import.meta.env.VITE_BTF_V2_LEDGER_ADDRESS || "0x77dee9090551A220E1062fF2E07636B1dD97bB56";
export const V2FlushLedgerAddress = import.meta.env.VITE_BTF_V2_FLUSH_LEDGER_ADDRESS || "0x96cea04e1ce19B0548F216C3D99BD68BcBBFCAE8";
export const HasTestUsdtFaucet = import.meta.env.VITE_BTF_TEST_USDT_FAUCET === "true";

// These old modules do not exist in V2 yet. They remain blank deliberately.
export const PackageManagerLensAddress = "";
export const RouterAddress = "";
export const StakeTokenAddress = "";
