// Addresses for this copied BSC Testnet UI. The original production UI is separate.
const configuredAddress = (value, fallback = "") => {
  const address = String(value || fallback).trim();
  return /^0x[0-9a-fA-F]{40}$/.test(address) ? address.toLowerCase() : address;
};

export const TokenAddress = configuredAddress("0xb602A2B700ba8bF788F06cC461EC8Fb1635e244D");
export const ReferralNetworkAddress = configuredAddress("0x81482D09896d43f171B54Adf0dd48FD7eEE23411");
export const PackageManagerAddress = configuredAddress("0x7f885a268CEE82bFd4922F05326eF1B2475Ed8c0");
// This is unused while package history is read directly. Set the actual
// Manager-proxy deployment block if event-history queries are enabled later.
export const V2DeploymentBlock = import.meta.env.VITE_BTF_V2_DEPLOYMENT_BLOCK || "0";
export const V2LedgerAddress = configuredAddress("0x27280212A450D97d43812C0cbd70F56D6bEec60E");
// DAO is kept configurable so a future governance deployment does not
// require a source-code change in the dashboard.
export const V2DaoAddress = configuredAddress("0x474d31f302BFbc46263c7B60Ac94e21a4B2cFa8F");
export const V2FlushLedgerAddress = configuredAddress("0x6417B44827933F8b19767F723cc2596601e9Ce01");
// Manual import is intentionally disabled: Mainnet uses verified V1 readers.
export const V2ManualLegacyImporterAddress = configuredAddress(import.meta.env.VITE_BTF_V2_MANUAL_LEGACY_IMPORTER_ADDRESS);
// Must always match `PackageManager.legacyImporter()`. The Manager accepts
// legacy package/Level-ROI calls only from this contract.
export const V2VerifiedLegacyImporterAddress = "";
export const V2VerifiedLegacyRankImporterAddress = "";
export const V2ManualLegacyLevelBridgeAddress = "";
export const V2LegacyRankCheckpointAddress = "";
export const HasTestUsdtFaucet = false;

// These old modules do not exist in V2 yet. They remain blank deliberately.
export const PackageManagerLensAddress = "";
export const RouterAddress = "";
export const StakeTokenAddress = "";
