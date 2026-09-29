import { ethers } from "ethers";
import { ReferralNetworkAddress } from "./address";
import { createBscReadProvider } from "./readProvider";

// Migration screens are an operational admin surface.  Keep this check tied
// to the central V2 Registry so every UI entry point uses the same authority.
const REGISTRY_ACCESS_ABI = [
  "function owner() view returns(address)",
  "function rootAddress() view returns(address)",
  "function migrationOperator(address) view returns(bool)",
];

// Confirmed migrated-wallet viewer. This wallet may enter the dashboard and
// inspect the Migration Data screen even before it has a V2 registration.
// Keep operational authority on-chain: owner/migrationOperator remain the
// normal source of truth for migration administration.
const MIGRATION_VIEWER_ADDRESSES = new Set([
  "0x8A4B5d9d6b40883d290EDf27d59aa4a9d31EAbAD".toLowerCase(),
]);

async function readAccess(address) {
  if (!ethers.isAddress(address || "")) {
    return {
      isOwner: false,
      isRoot: false,
      isMigrationOperator: false,
      isMigrationViewer: false,
    };
  }

  const registry = new ethers.Contract(
    ReferralNetworkAddress,
    REGISTRY_ACCESS_ABI,
    createBscReadProvider(),
  );
  const [owner, root, isMigrationOperator] = await Promise.all([
    registry.owner(),
    registry.rootAddress(),
    registry.migrationOperator(address),
  ]);
  const wallet = address.toLowerCase();
  return {
    isOwner: owner.toLowerCase() === wallet,
    isRoot: root.toLowerCase() === wallet,
    isMigrationOperator,
    isMigrationViewer: MIGRATION_VIEWER_ADDRESSES.has(wallet),
  };
}

// The sensitive Migration Data tab is only for the Registry owner and the
// explicitly authorised migration wallet. Root may use the normal dashboard,
// but cannot open the migration operations surface merely by being root.
export async function canAccessMigration(address) {
  try {
    const access = await readAccess(address);
    return access.isOwner || access.isMigrationOperator || access.isMigrationViewer;
  } catch {
    // Do not expose the migration interface when the authority cannot be read.
    return false;
  }
}

// A normal unregistered wallet must stay on Login. These three operational
// addresses may still enter the dashboard without registering as a member.
export async function canAccessDashboardWithoutRegistration(address) {
  try {
    const access = await readAccess(address);
    return access.isOwner || access.isRoot || access.isMigrationOperator || access.isMigrationViewer;
  } catch {
    return false;
  }
}
