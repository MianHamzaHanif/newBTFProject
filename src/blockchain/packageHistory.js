// Adapt the new direct Manager's public history mapping to the older UI's
// package-row shape. Per-package generated ROI is not exposed by this Manager.
export async function readPackageHistory(manager, user, index) {
  const row = await manager.packageHistory(user, index);
  const amount = row.amount ?? row[0];
  const purchasedAt = row.purchasedAt ?? row[1];
  const deactivatedAt = row.deactivatedAt ?? row[2];
  const roiMaximum = row.selfRoiMaximum ?? row[3];
  const active = deactivatedAt === 0n;
  // The Manager exposes only aggregate generated ROI. It is exact for a
  // single-package user; multiple-package rows have no per-row figure.
  const length = await manager.getPackageHistoryLength(user);
  const roiGenerated = length === 1n ? await manager.selfRoiGenerated(user) : 0n;
  const result = [amount, purchasedAt, deactivatedAt, roiGenerated, roiMaximum, active];
  Object.assign(result, { amount, purchasedAt, deactivatedAt, roiGenerated, roiMaximum, active });
  return result;
}
