import { createBscReadProvider } from "./readProvider";

// Historical V2 records created after this BSC block belong to the old flow
// that must not be displayed in the merged V1/V2/V3 history tables.
const LEGACY_V2_HISTORY_CUTOFF_BLOCK = 131859768;

let cutoffTimestampPromise;

export function getLegacyV2HistoryCutoffTimestamp() {
  if (!cutoffTimestampPromise) {
    cutoffTimestampPromise = createBscReadProvider()
      .getBlock(LEGACY_V2_HISTORY_CUTOFF_BLOCK)
      .then((block) => {
        if (!block?.timestamp) throw new Error("V2 history cutoff block was not found");
        return BigInt(block.timestamp);
      });
  }
  return cutoffTimestampPromise;
}

export function isLegacyV2HistoryVisible(timestamp, cutoffTimestamp) {
  // Records exactly at the cutoff remain visible. Only later V2 records hide.
  return BigInt(timestamp ?? 0n) <= cutoffTimestamp;
}
