import { ethers } from "ethers";
import { ReferralNetworkAddress } from "./address";
import { createBscReadProvider } from "./readProvider";

// Migration screens are an operational admin surface.  Keep this check tied
// to the central V2 Registry so every UI entry point uses the same authority.
const REGISTRY_ACCESS_ABI = [
  "function owner() view returns(address)",
  "function migrationOperator(address) view returns(bool)",
];

export async function canAccessMigration(address) {
  if (!ethers.isAddress(address || "")) return false;

  try {
    const registry = new ethers.Contract(
      ReferralNetworkAddress,
      REGISTRY_ACCESS_ABI,
      createBscReadProvider(),
    );
    const [owner, isMigrationOperator] = await Promise.all([
      registry.owner(),
      registry.migrationOperator(address),
    ]);
    return owner.toLowerCase() === address.toLowerCase() || isMigrationOperator;
  } catch {
    // Do not expose the migration interface when the authority cannot be read.
    return false;
  }
}
