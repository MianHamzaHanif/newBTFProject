import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { getReadWalletAddress } from "../../../blockchain/readProvider";
import { BSC_TESTNET, WALLET_ADD_CHAIN_PARAMS } from "../../../blockchain/bscTestnetConfig";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import { ReferralNetworkAddress, V2ManualLegacyImporterAddress } from "../../../blockchain/address";
import V2RegistryABI from "../../../blockchain/v2ReferralRegistryABI";
import "../styles/style.css";

const V1_MANAGER_ABI = [
  "function getStakeHistoryLength(address) view returns(uint256)",
  "function userStakeHistory(address,uint256) view returns(uint256 packageValue,uint256 usdtAmount,uint256 tokenAmount,uint256 burnAmount,uint256 ownerLockAmount,uint256 userLockAmount,uint256 roiClaimed,uint256 timestamp)",
  "function getStakeIncomeStatus(address,uint256) view returns(uint256 incomeLimit,uint256 usedIncome,uint256 remainingIncome,bool completed)",
  "function getStakeRoiInfo(address,uint256) view returns(uint256 principal,uint256 maxRoi,uint256 totalAccrued,uint256 claimed,uint256 claimable)",
  "function pendingDirectIncomeToken(address) view returns(uint256)"
];
const IMPORTER_ABI = [
  "function owner() view returns(address)",
  "function migrationOperator(address) view returns(bool)",
  "function imported(address,uint256) view returns(bool)",
  "function importVerifiedPackage(address user,uint256 sourceIndex,uint256 amount,uint256 usedIncome,uint256 generatedSelfRoi,uint256 unpaidSelfRoi,uint256 originalPurchasedAt,uint256 unpaidDirectIncome)"
];

const format = (value) => Number(ethers.formatUnits(value || 0n, 18)).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });

async function ensureBscTestnet() {
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (BigInt(chainId) === BigInt(BSC_TESTNET.chainId)) return;
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: WALLET_ADD_CHAIN_PARAMS.chainId }] });
  } catch (error) {
    if (error?.code !== 4902) throw error;
    await window.ethereum.request({ method: "wallet_addEthereumChain", params: [WALLET_ADD_CHAIN_PARAMS] });
  }
}

export default function MigrationData() {
  const [connectedAddress, setConnectedAddress] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  const loadSnapshot = useCallback(async (requestedAddress) => {
    const user = (requestedAddress || addressInput).trim();
    if (!ethers.isAddress(user)) {
      setSnapshot(null);
      setMessage("Enter a valid V1 wallet address.");
      return;
    }
    try {
      setLoading(true);
      setMessage("");
      // Mainnet is read-only. No wallet/provider signing is used for this data.
      const request = new ethers.FetchRequest(V1_MAINNET.rpcUrl);
      request.timeout = 20_000;
      const v1Provider = new ethers.JsonRpcProvider(request, V1_MAINNET.chainId, { staticNetwork: true, batchMaxCount: 1 });
      const manager = new ethers.Contract(V1_MAINNET.packageManager, V1_MANAGER_ABI, v1Provider);
      const [count, pendingDirect] = await Promise.all([manager.getStakeHistoryLength(user), manager.pendingDirectIncomeToken(user)]);
      const packages = await Promise.all(Array.from({ length: Number(count) }, async (_, sourceIndex) => {
        const [stake, income, roi] = await Promise.all([
          manager.userStakeHistory(user, sourceIndex),
          manager.getStakeIncomeStatus(user, sourceIndex),
          manager.getStakeRoiInfo(user, sourceIndex)
        ]);
        return {
          sourceIndex,
          amount: stake.usdtAmount,
          usedIncome: income.usedIncome,
          remainingIncome: income.remainingIncome,
          completed: income.completed,
          generatedSelfRoi: roi.totalAccrued,
          unpaidSelfRoi: roi.claimable,
          purchasedAt: stake.timestamp,
          alreadyImported: false
        };
      }));
      const activePackages = packages.filter((item) => !item.completed && item.remainingIncome > 0n);

      const v2Provider = new ethers.JsonRpcProvider(BSC_TESTNET.rpcUrls[0], BSC_TESTNET.chainId, { staticNetwork: true });
      const [registryUser, importer] = await Promise.all([
        new ethers.Contract(ReferralNetworkAddress, V2RegistryABI, v2Provider).users(user),
        new ethers.Contract(V2ManualLegacyImporterAddress, IMPORTER_ABI, v2Provider)
      ]);
      const activeWithImportStatus = await Promise.all(activePackages.map(async (item) => ({ ...item, alreadyImported: await importer.imported(user, item.sourceIndex) })));
      setAddressInput(user);
      // Existing V2 Registry data means the user's referral/tree structure is
      // present and the package importer may safely target this account.
      const v2StructureReady = Boolean(registryUser?.exists ?? registryUser?.[8]);
      setSnapshot({ user, activePackages: activeWithImportStatus, pendingDirect, v2Migrated: v2StructureReady, v2Exists: v2StructureReady });
      if (!activeWithImportStatus.length) setMessage("No active V1 package is available to import for this address.");
    } catch (error) {
      setSnapshot(null);
      setMessage(error?.shortMessage || error?.message || "Could not read V1 migration data.");
    } finally {
      setLoading(false);
    }
  }, [addressInput]);

  useEffect(() => {
    getReadWalletAddress().then((address) => {
      setConnectedAddress(address);
      setAddressInput(address);
      if (ethers.isAddress(address)) loadSnapshot(address);
    });
  }, [loadSnapshot]);

  const importPackages = async () => {
    if (!snapshot || !window.ethereum) return;
    const outstanding = snapshot.activePackages.filter((item) => !item.alreadyImported);
    if (!outstanding.length) {
      setMessage("All active packages in this snapshot are already imported.");
      return;
    }
    try {
      setImporting(true);
      setMessage("Please confirm the import transaction(s) in your wallet.");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureBscTestnet();
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const caller = await signer.getAddress();
      const importer = new ethers.Contract(V2ManualLegacyImporterAddress, IMPORTER_ABI, signer);
      const [owner, operator] = await Promise.all([importer.owner(), importer.migrationOperator(caller)]);
      if (caller.toLowerCase() !== owner.toLowerCase() && !operator) {
        throw new Error("Connected wallet is not an authorized V2 migration operator.");
      }
      for (let index = 0; index < outstanding.length; index += 1) {
        const item = outstanding[index];
        const directIncome = index === 0 ? snapshot.pendingDirect : 0n;
        setMessage(`Importing V1 package #${item.sourceIndex}. Confirm in wallet...`);
        const tx = await importer.importVerifiedPackage(snapshot.user, item.sourceIndex, item.amount, item.usedIncome, item.generatedSelfRoi, item.unpaidSelfRoi, item.purchasedAt, directIncome);
        await tx.wait();
      }
      setMessage("Active package migration completed successfully. Level ROI, Power and Reward are not changed here.");
      await loadSnapshot(snapshot.user);
      window.dispatchEvent(new Event("btf:v2-data-changed"));
    } catch (error) {
      setMessage(error?.shortMessage || error?.reason || error?.message || "Migration transaction failed.");
    } finally {
      setImporting(false);
    }
  };

  const importable = snapshot?.activePackages.filter((item) => !item.alreadyImported) || [];
  const totalSelfRoi = snapshot?.activePackages.reduce((sum, item) => sum + item.unpaidSelfRoi, 0n) || 0n;

  return <div className="page-container">
    <h1>Migration Data</h1>
    <div className="table-wrapper"><div className="table-card">
      <p className="mb-2">V1 Mainnet data is calculated first. Clicking Import sends V2 Testnet transactions only after review.</p>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <input className="form-control" style={{ maxWidth: 460 }} value={addressInput} onChange={(e) => setAddressInput(e.target.value)} placeholder="V1 wallet address" />
        <button className="btn btn-outline-primary" onClick={() => loadSnapshot()} disabled={loading || importing}>{loading ? "Calculating..." : "Calculate Migration Data"}</button>
      </div>
      {connectedAddress && <p className="text-muted small">Connected caller: {connectedAddress}</p>}
      {message && <p className="team-loading">{message}</p>}
      {snapshot && <>
        <div className="withdrawal-grid mb-4">
          <div className="withdrawal-card"><p className="withdrawal-card-title">Active V1 Packages</p><h4 className="withdrawal-card-value">{snapshot.activePackages.length}</h4></div>
          <div className="withdrawal-card"><p className="withdrawal-card-title">Self ROI to Import</p><h4 className="withdrawal-card-value">{format(totalSelfRoi)} USDT</h4></div>
          <div className="withdrawal-card"><p className="withdrawal-card-title">Direct Income to Import</p><h4 className="withdrawal-card-value">{format(snapshot.pendingDirect)} USDT</h4></div>
          <div className="withdrawal-card"><p className="withdrawal-card-title">V2 Structure</p><h4 className="withdrawal-card-value">{snapshot.v2Migrated ? "Migrated" : "Not Migrated"}</h4></div>
        </div>
        <div className="table-responsive"><table className="table"><thead><tr><th>V1 Package</th><th>Amount</th><th>Used Income</th><th>Remaining Income</th><th>Self ROI</th><th>Status</th></tr></thead><tbody>
          {snapshot.activePackages.map((item) => <tr key={item.sourceIndex}><td>#{item.sourceIndex}</td><td>{format(item.amount)} USDT</td><td>{format(item.usedIncome)}</td><td>{format(item.remainingIncome)}</td><td>{format(item.unpaidSelfRoi)}</td><td>{item.alreadyImported ? "Already Imported" : "Ready to Import"}</td></tr>)}
        </tbody></table></div>
        <button className="btn btn-primary" disabled={importing || !snapshot.v2Migrated || !importable.length} onClick={importPackages}>{importing ? "Migrating..." : `OK – Import ${importable.length} Active Package(s)`}</button>
        {!snapshot.v2Migrated && <p className="text-danger mt-2">V2 structure must be migrated before package import.</p>}
      </>}
    </div></div>
  </div>;
}
