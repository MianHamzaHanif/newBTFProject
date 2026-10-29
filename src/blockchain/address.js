// Active BSC Mainnet deployment (V3). These values are used for every
// user-facing transaction: registration, package purchase, claim and withdraw.
// V1/V2 addresses remain explicitly available below for historical reads only.
const configuredAddress = (value, fallback = "") => {
  const address = String(value || fallback).trim();
  return /^0x[0-9a-fA-F]{40}$/.test(address) ? address.toLowerCase() : address;
};

// V3 active settlement is BTF until the DAO performs its one-time USDT switch.
export const TokenAddress = configuredAddress(import.meta.env.VITE_BTF_V3_TOKEN_ADDRESS, "0xc6D2d2E5894Bbe5c2DEBa2b9069184740634Cf03");
export const SettlementTokenSymbol = import.meta.env.VITE_BTF_SETTLEMENT_TOKEN_SYMBOL || "BTF";
export const ReferralNetworkAddress = configuredAddress(import.meta.env.VITE_BTF_V3_REGISTRY_ADDRESS, "0xDB9FfA388F7ba5992B352413Bae7dc8049269bB0");
export const V3ReferralRegistryAddress = ReferralNetworkAddress;
export const PackageManagerAddress = configuredAddress(import.meta.env.VITE_BTF_V3_PACKAGE_MANAGER_ADDRESS, "0x43799895581198966b551C42806C19a5517eD1Cb");
export const V2LedgerAddress = configuredAddress(import.meta.env.VITE_BTF_V3_LEDGER_ADDRESS, "0x766d9FdC5B5dCD157d4C28e2330683e87CCCcf2E");
export const V2DaoAddress = configuredAddress(import.meta.env.VITE_BTF_V3_DAO_ADDRESS, "0xC780F67c2390e92A68C579604A94ebdD0cE22533");
export const V2FlushLedgerAddress = configuredAddress(import.meta.env.VITE_BTF_V3_FLUSH_LEDGER_ADDRESS, "0xE707776b4ea7945F806Cff9e718c3ecb78aFb454");
export const IncomeReadyLensAddress = configuredAddress(import.meta.env.VITE_BTF_V3_INCOME_READY_LENS_ADDRESS, "0xA5D955BF8578026F7dbBe6fC960c327b79c7038D");
export const PackageMigrationSourceAddress = configuredAddress(import.meta.env.VITE_BTF_V3_PACKAGE_MIGRATION_SOURCE_ADDRESS, "0x15446FB8a12d899DdD57Cf23d66dC03250C2376D");
export const V2DeploymentBlock = import.meta.env.VITE_BTF_V3_DEPLOYMENT_BLOCK || "0";

// Legacy source deployments: use only for V1/V2 history and migration reads.
export const LegacyV2RegistryAddress = configuredAddress(import.meta.env.VITE_BTF_LEGACY_V2_REGISTRY_ADDRESS, "0x00ad2Ed79caD313F2552d3Ca5195C6dbAec0E9A3");
export const LegacyV2PackageManagerAddress = configuredAddress(import.meta.env.VITE_BTF_LEGACY_V2_PACKAGE_MANAGER_ADDRESS, "0x0Cea945825244ff264ECf35C8474138c0A52ed1b");
export const LegacyV2LedgerAddress = configuredAddress(import.meta.env.VITE_BTF_LEGACY_V2_LEDGER_ADDRESS, "0x43FCBb62871738B62579bD2D04e13b9be7197abd");
export const LegacyV2DaoAddress = configuredAddress(import.meta.env.VITE_BTF_LEGACY_V2_DAO_ADDRESS, "0xa680C357A19122bdcD493100f6218653B090daAE");
export const LegacyV2FlushLedgerAddress = configuredAddress(import.meta.env.VITE_BTF_LEGACY_V2_FLUSH_LEDGER_ADDRESS, "0xc23CE8Ab0B04f7876aeC33bA29F162b09e3Ff3B3");

// Legacy importer addresses are retained for the old migration-admin screen.
export const V2ManualLegacyImporterAddress = configuredAddress(import.meta.env.VITE_BTF_V2_MANUAL_LEGACY_IMPORTER_ADDRESS);
// Must always match `PackageManager.legacyImporter()`. The Manager accepts
// legacy package/Level-ROI calls only from this contract.
export const V2VerifiedLegacyImporterAddress = configuredAddress(import.meta.env.VITE_BTF_V2_VERIFIED_LEGACY_IMPORTER_ADDRESS, "0xC849Bf4a5D283D21cA9C5772D1D1d85860213470");
export const V2VerifiedLegacyRankImporterAddress = configuredAddress(import.meta.env.VITE_BTF_V2_VERIFIED_LEGACY_RANK_IMPORTER_ADDRESS, "0xc1Ea0Ee60EECfE840A5b39d4881807331777E162");
export const V2ManualLegacyLevelBridgeAddress = configuredAddress(import.meta.env.VITE_BTF_V2_MANUAL_LEGACY_LEVEL_BRIDGE_ADDRESS, "0xC66Bc2e4dbf27Bb6E04291Fa422a7FB41b24e54E");
export const V2LegacyRankCheckpointAddress = configuredAddress(import.meta.env.VITE_BTF_V2_LEGACY_RANK_CHECKPOINT_ADDRESS, "0x162d392EC1C2A2eC1e7379b8b50Bf196aC9361BE");
// Keep actions closed until the registration/package migration is reviewed.
// Set VITE_BTF_V3_ACTIONS_ENABLED=true only after migration is finished.
export const V3ActionsEnabled = String(import.meta.env.VITE_BTF_V3_ACTIONS_ENABLED || "false").toLowerCase() === "true";
export const HasTestUsdtFaucet = false;

// These old modules do not exist in V2 yet. They remain blank deliberately.
export const PackageManagerLensAddress = "";
export const RouterAddress = "";
export const StakeTokenAddress = "";
