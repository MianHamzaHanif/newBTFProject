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

async function readAccess(address) {
  if (!ethers.isAddress(address || "")) return { isOwner: false, isRoot: false, isMigrationOperator: false };

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
  };
}

// The sensitive Migration Data tab is only for the Registry owner and the
// explicitly authorised migration wallet. Root may use the normal dashboard,
// but cannot open the migration operations surface merely by being root.
export async function canAccessMigration(address) {
  try {
    const access = await readAccess(address);
    return access.isOwner || access.isMigrationOperator;
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
    return access.isOwner || access.isRoot || access.isMigrationOperator;
  } catch {
    return false;
  }
}
