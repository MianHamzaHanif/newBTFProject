import { ethers } from "ethers";
import { V2VerifiedLegacyImporterAddress } from "./address";
import { createBscReadProvider } from "./readProvider";

// Normal package import deliberately leaves V1 withdrawal available. Only
// the explicit withdrawal-disabled path records this snapshot flag.
const IMPORTER_ABI = ["function legacyPendingDirectSnapshotTaken(address) view returns(bool)"];

// Keep prior verified importer deployments here as well as the currently
// configured deployment. A user may have been imported before the importer
// implementation was replaced.
const KNOWN_IMPORTERS = [
  V2VerifiedLegacyImporterAddress,
  "0xb22ee2c161e401f9b39368b1e36006dc337d4559",
  "0xbd6d25c7ac5ca0c2931f9fdad9756248ae5e850c",
];

export async function hasImportedLegacyPackage(user) {
  if (!ethers.isAddress(user || "")) return false;

  const importers = [...new Set(
    KNOWN_IMPORTERS
      .filter((address) => ethers.isAddress(address || ""))
      .map((address) => address.toLowerCase()),
  )];
  const provider = createBscReadProvider();
  const results = await Promise.allSettled(
    importers.map((address) => new ethers.Contract(address, IMPORTER_ABI, provider).legacyPendingDirectSnapshotTaken(user)),
  );
  const readable = results.filter((result) => result.status === "fulfilled");

  // Never let an RPC outage accidentally re-enable a V1 withdrawal route.
  if (readable.length === 0) throw new Error("Could not verify V1 withdrawal migration status.");
  return readable.some((result) => Boolean(result.value));
}
