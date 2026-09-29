// BSC Mainnet V2 values. Environment variables permit a later redeployment,
// while these fallbacks keep the public build aligned with the live proxies.
export const TokenAddress = import.meta.env.VITE_BTF_USDT_ADDRESS || "0x55d398326f99059fF775485246999027B3197955";
export const ReferralNetworkAddress = import.meta.env.VITE_BTF_V2_REGISTRY_ADDRESS || "0x00ad2Ed79caD313F2552d3Ca5195C6dbAec0E9A3";
export const PackageManagerAddress = import.meta.env.VITE_BTF_V2_PACKAGE_MANAGER_ADDRESS || "0x0Cea945825244ff264ECf35C8474138c0A52ed1b";
// This is unused while package history is read directly. Set the actual
// Manager-proxy deployment block if event-history queries are enabled later.
export const V2DeploymentBlock = import.meta.env.VITE_BTF_V2_DEPLOYMENT_BLOCK || "0";
export const V2LedgerAddress = import.meta.env.VITE_BTF_V2_LEDGER_ADDRESS || "0x43FCBb62871738B62579bD2D04e13b9be7197abd";
export const V2FlushLedgerAddress = import.meta.env.VITE_BTF_V2_FLUSH_LEDGER_ADDRESS || "0xc23CE8Ab0B04f7876aeC33bA29F162b09e3Ff3B3";
// Manual import is intentionally disabled: Mainnet uses verified V1 readers.
export const V2ManualLegacyImporterAddress = import.meta.env.VITE_BTF_V2_MANUAL_LEGACY_IMPORTER_ADDRESS || "";
export const V2VerifiedLegacyImporterAddress = import.meta.env.VITE_BTF_V2_VERIFIED_LEGACY_IMPORTER_ADDRESS || "0xBd6d25c7Ac5cA0c2931f9FdAD9756248Ae5E850C";
export const V2VerifiedLegacyRankImporterAddress = import.meta.env.VITE_BTF_V2_VERIFIED_LEGACY_RANK_IMPORTER_ADDRESS || "0xc1Ea0Ee60EECfE840A5b39d4881807331777E162";
export const V2ManualLegacyLevelBridgeAddress = import.meta.env.VITE_BTF_V2_MANUAL_LEGACY_LEVEL_BRIDGE_ADDRESS || "0xC66Bc2e4dbf27Bb6E04291Fa422a7FB41b24e54E";
export const V2LegacyRankCheckpointAddress = import.meta.env.VITE_BTF_V2_LEGACY_RANK_CHECKPOINT_ADDRESS || "0x162d392EC1C2A2eC1e7379b8b50Bf196aC9361BE";
export const HasTestUsdtFaucet = false;

// These old modules do not exist in V2 yet. They remain blank deliberately.
export const PackageManagerLensAddress = "";
export const RouterAddress = "";
export const StakeTokenAddress = "";
