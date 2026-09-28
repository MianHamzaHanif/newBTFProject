// BSC Testnet V2 values. The Hardhat deployment script writes these into
// .env.local after a successful deployment. The fallbacks keep the deployed
// Vercel UI functional if its build-time VITE variables are missing or stale.
export const TokenAddress = import.meta.env.VITE_BTF_TESTNET_USDT_ADDRESS || "0xb602A2B700ba8bF788F06cC461EC8Fb1635e244D";
export const ReferralNetworkAddress = import.meta.env.VITE_BTF_V2_REGISTRY_ADDRESS || "0x0a7a84485A8EAc887775A17d80f2b5D8c104c8DB";
export const PackageManagerAddress = import.meta.env.VITE_BTF_V2_PACKAGE_MANAGER_ADDRESS || "0x330cbC0ed37359181EF79D7c4535120dE538Aed1";
export const V2DeploymentBlock = import.meta.env.VITE_BTF_V2_DEPLOYMENT_BLOCK || "133703977";
export const V2LedgerAddress = import.meta.env.VITE_BTF_V2_LEDGER_ADDRESS || "0x80A2Ffafd2d1dC8C19787100EAC7d9bFE7733691";
export const V2FlushLedgerAddress = import.meta.env.VITE_BTF_V2_FLUSH_LEDGER_ADDRESS || "0xc3CcF77f8603afd14DA7a4076e17e6c15a571167";
export const V2ManualLegacyImporterAddress = import.meta.env.VITE_BTF_V2_MANUAL_LEGACY_IMPORTER_ADDRESS || "0x7cBeac3320cBcD092Ef3ddB7EA14668C7eCC2265";
export const V2ManualLegacyLevelBridgeAddress = import.meta.env.VITE_BTF_V2_MANUAL_LEGACY_LEVEL_BRIDGE_ADDRESS || "0x0cA7958Da9b2c3C65B88dd554a1b57A0d586130a";
export const V2LegacyRankCheckpointAddress = import.meta.env.VITE_BTF_V2_LEGACY_RANK_CHECKPOINT_ADDRESS || "0x24DE623e6f3cf27B5A0F17d2bc4Bd13c5afD2bF3";
export const HasTestUsdtFaucet = import.meta.env.VITE_BTF_TEST_USDT_FAUCET === "true";

// These old modules do not exist in V2 yet. They remain blank deliberately.
export const PackageManagerLensAddress = "";
export const RouterAddress = "";
export const StakeTokenAddress = "";
