// BSC Testnet V2 values. The Hardhat deployment script writes these into
// .env.local after a successful deployment. The fallbacks keep the deployed
// Vercel UI functional if its build-time VITE variables are missing or stale.
export const TokenAddress = import.meta.env.VITE_BTF_TESTNET_USDT_ADDRESS || "0xb602A2B700ba8bF788F06cC461EC8Fb1635e244D";
export const ReferralNetworkAddress = import.meta.env.VITE_BTF_V2_REGISTRY_ADDRESS || "0xC8fd38BD3804192B6BCC71673C0c5cEE39c25E3f";
export const PackageManagerAddress = import.meta.env.VITE_BTF_V2_PACKAGE_MANAGER_ADDRESS || "0x11eB621045099DdedC22dC0AddcA50b87050f8eD";
export const V2DeploymentBlock = import.meta.env.VITE_BTF_V2_DEPLOYMENT_BLOCK || "133848458";
export const V2LedgerAddress = import.meta.env.VITE_BTF_V2_LEDGER_ADDRESS || "0x80F0Da4d72EEab66143A0331a842bBfC94768bd5";
export const V2FlushLedgerAddress = import.meta.env.VITE_BTF_V2_FLUSH_LEDGER_ADDRESS || "0xFb87DDB207202a5907a57D713ed000a846CB180F";
export const V2ManualLegacyImporterAddress = import.meta.env.VITE_BTF_V2_MANUAL_LEGACY_IMPORTER_ADDRESS || "0x57bF853eEf06ac9c0151da94881bD6F833013757";
// Set this only for the Mainnet deployment. When present, Migration Data
// reads the V1 package snapshot on-chain and accepts no manual income values.
export const V2VerifiedLegacyImporterAddress = import.meta.env.VITE_BTF_V2_VERIFIED_LEGACY_IMPORTER_ADDRESS || "";
export const V2VerifiedLegacyRankImporterAddress = import.meta.env.VITE_BTF_V2_VERIFIED_LEGACY_RANK_IMPORTER_ADDRESS || "";
export const V2ManualLegacyLevelBridgeAddress = import.meta.env.VITE_BTF_V2_MANUAL_LEGACY_LEVEL_BRIDGE_ADDRESS || "0x2AEdc56625B390844E6cc998821d24D63B476792";
export const V2LegacyRankCheckpointAddress = import.meta.env.VITE_BTF_V2_LEGACY_RANK_CHECKPOINT_ADDRESS || "0x777f1778951812879D8CD5D96C13e64325349287";
export const HasTestUsdtFaucet = import.meta.env.VITE_BTF_TEST_USDT_FAUCET === "true";

// These old modules do not exist in V2 yet. They remain blank deliberately.
export const PackageManagerLensAddress = "";
export const RouterAddress = "";
export const StakeTokenAddress = "";
