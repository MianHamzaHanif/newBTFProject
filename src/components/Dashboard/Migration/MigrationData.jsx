import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getReadWalletAddress } from "../../../blockchain/readProvider";
import { canAccessMigration } from "../../../blockchain/migrationAccess";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import { BSC_MAINNET, WALLET_ADD_CHAIN_PARAMS } from "../../../blockchain/bscMainnetConfig";
import { ReferralNetworkAddress, StructureMigratorAddress } from "../../../blockchain/address";
import "./MigrationData.css";
import "../styles/style.css";

const V1_REGISTRY_ABI = [
  "function users(address) view returns(uint256 id,address referral,uint256 registeredAt,uint256 totalTeam,uint256 totalTeamDeposit,uint256 selfDeposit,uint256 totalTeamStakeToken,uint256 selfStakeToken,bool exists)",
  "function isLevelOpen(address user,uint256 level) view returns(bool)",
];
const V3_REGISTRY_ABI = [
  "function isMigrationAuthority(address) view returns(bool)",
  "function migrated(address) view returns(bool)",
  "function v1LevelBusinessImported(address) view returns(bool)",
  "function v1LevelBusinessLevelImported(address,uint256) view returns(bool)",
  "function legacyLevelRemaining(address,uint256) view returns(uint256)",
];
const STRUCTURE_MIGRATOR_ABI = [
  "function phase() view returns(uint8)",
  "function v1LevelBusinessRecoveryFinished() view returns(bool)",
  "function recoverV1LevelBusinessFromSource(address user,uint256 level)",
];

const normalizeAddress = (value) => {
  const address = String(value || "").trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return address;
  return address.toLowerCase();
};

const createV1ReadProvider = () => {
  const request = new ethers.FetchRequest(V1_MAINNET.rpcUrl);
  request.timeout = 30_000;
  return new ethers.JsonRpcProvider(request, V1_MAINNET.chainId, {
    staticNetwork: true,
    batchMaxCount: 1,
    batchStallTime: 0,
  });
};

async function ensureBscMainnet() {
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (BigInt(chainId) === BigInt(BSC_MAINNET.chainId)) return;
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: WALLET_ADD_CHAIN_PARAMS.chainId }] });
  } catch (error) {
    if (error?.code !== 4902) throw error;
    await window.ethereum.request({ method: "wallet_addEthereumChain", params: [WALLET_ADD_CHAIN_PARAMS] });
  }
}

export default function MigrationData() {
  const [canViewMigration, setCanViewMigration] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [user, setUser] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [openLevels, setOpenLevels] = useState([]);
  const [checking, setChecking] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    getReadWalletAddress().then(async (wallet) => {
      const allowed = await canAccessMigration(wallet);
      if (!cancelled) {
        setCanViewMigration(allowed);
        setAccessChecked(true);
      }
    }).catch(() => { if (!cancelled) setAccessChecked(true); });
    return () => { cancelled = true; };
  }, []);

  const checkUser = async () => {
    const wallet = normalizeAddress(user);
    if (!ethers.isAddress(wallet)) {
      setMessage("Enter a valid V1 user wallet address.");
      return;
    }
    try {
      setChecking(true);
      setMessage("Reading V1 open levels and V3 recovery status...");
      const [v1Registry, v3Registry, migrator] = [
        new ethers.Contract(V1_MAINNET.referralNetwork, V1_REGISTRY_ABI, createV1ReadProvider()),
        new ethers.Contract(ReferralNetworkAddress, V3_REGISTRY_ABI, new ethers.JsonRpcProvider(BSC_MAINNET.rpcUrls[0], BSC_MAINNET.chainId, { staticNetwork: true })),
        new ethers.Contract(StructureMigratorAddress, STRUCTURE_MIGRATOR_ABI, new ethers.JsonRpcProvider(BSC_MAINNET.rpcUrls[0], BSC_MAINNET.chainId, { staticNetwork: true })),
      ];
      const [v1User, migrated, importedAll, phase, recoveryFinished] = await Promise.all([
        v1Registry.users(wallet),
        v3Registry.migrated(wallet),
        v3Registry.v1LevelBusinessImported(wallet),
        migrator.phase(),
        migrator.v1LevelBusinessRecoveryFinished(),
      ]);
      if (!Boolean(v1User[8])) throw new Error("This wallet is not registered in V1.");
      if (!Boolean(migrated)) throw new Error("This user is not migrated to V3.");
      if (Boolean(importedAll)) throw new Error("This user already received the normal V1 Level Business import; recovery is blocked.");
      if (BigInt(phase) !== 2n) throw new Error("V3 registration migration is not complete.");
      if (Boolean(recoveryFinished)) throw new Error("V1 Level Business recovery has been permanently finished.");

      const states = await Promise.all(Array.from({ length: 15 }, async (_, index) => {
        const [isOpen, alreadyImported] = await Promise.all([
          v1Registry.isLevelOpen(wallet, index),
          v3Registry.v1LevelBusinessLevelImported(wallet, index),
        ]);
        return { level: index + 1, isOpen: Boolean(isOpen), alreadyImported: Boolean(alreadyImported) };
      }));
      const eligible = states.filter((state) => state.isOpen && !state.alreadyImported);
      setOpenLevels(eligible);
      setSelectedLevel(eligible.length === 1 ? String(eligible[0].level) : "");
      setMessage(eligible.length
        ? `V1 open levels found: ${eligible.map((state) => state.level).join(", ")}. Select one level to recover.`
        : "No recoverable V1 open level exists. Closed or already-imported levels cannot be submitted.");
    } catch (error) {
      setOpenLevels([]);
      setSelectedLevel("");
      setMessage(error?.shortMessage || error?.message || "Could not verify this user.");
    } finally {
      setChecking(false);
    }
  };

  const recover = async () => {
    const wallet = normalizeAddress(user);
    const level = Number(selectedLevel);
    if (!ethers.isAddress(wallet) || !Number.isInteger(level) || level < 1 || level > 15) {
      setMessage("Enter a valid user and select an open Level 1–15.");
      return;
    }
    if (!openLevels.some((entry) => entry.level === level)) {
      setMessage("Only a V1-open and not-yet-imported level can be recovered.");
      return;
    }
    if (!window.ethereum) {
      setMessage("MetaMask or Trust Wallet is required.");
      return;
    }
    try {
      setRecovering(true);
      setMessage("Checking migration access and simulating recovery...");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureBscMainnet();
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const caller = await signer.getAddress();
      const registry = new ethers.Contract(ReferralNetworkAddress, V3_REGISTRY_ABI, signer);
      if (!await registry.isMigrationAuthority(caller)) {
        throw new Error("This wallet is not an approved V3 migration operator.");
      }
      const migrator = new ethers.Contract(StructureMigratorAddress, STRUCTURE_MIGRATOR_ABI, signer);
      // The contract repeats the V1 open-level and duplicate-import checks.
      // staticCall prevents opening a wallet confirmation for an invalid level.
      await migrator.recoverV1LevelBusinessFromSource.staticCall(wallet, level - 1);
      setMessage(`Confirm V1 Level ${level} recovery in your wallet.`);
      const tx = await migrator.recoverV1LevelBusinessFromSource(wallet, level - 1);
      await tx.wait();
      const remaining = await registry.legacyLevelRemaining(wallet, level - 1);
      setOpenLevels((current) => current.filter((entry) => entry.level !== level));
      setSelectedLevel("");
      setMessage(`Level ${level} recovered successfully. Imported active business: ${ethers.formatUnits(remaining, 18)} USDT.`);
    } catch (error) {
      setMessage(error?.shortMessage || error?.reason || error?.message || "Level Business recovery failed.");
    } finally {
      setRecovering(false);
    }
  };

  if (!accessChecked) return <div className="page-container migration-page"><div className="migration-form-shell"><p className="migration-panel-note">Checking migration access...</p></div></div>;
  if (!canViewMigration) return <div className="page-container migration-page"><div className="migration-form-shell"><div className="migration-form-heading"><div className="migration-form-icon"><i className="bi bi-shield-lock" /></div><div><h1>Migration Access Restricted</h1><p>Only a DAO-approved V3 migration wallet can use this recovery page.</p></div></div></div></div>;

  return <div className="page-container migration-page"><div className="migration-form-shell">
    <div className="migration-form-heading"><div className="migration-form-icon"><i className="bi bi-arrow-left-right" /></div><div><h1>V1 Level Business Recovery</h1><p>Only recover one verified V1-open level at a time.</p></div></div>
    <div className="migration-level-panel">
      <div className="migration-section-title"><span>1</span> V1 User</div>
      <div className="migration-address-row"><div className="migration-field migration-field-wide"><label>User Wallet Address</label><input value={user} onChange={(event) => setUser(normalizeAddress(event.target.value))} placeholder="0x..." autoComplete="off" /></div><button type="button" className="migration-secondary-button" onClick={checkUser} disabled={checking || recovering}>{checking ? "Checking..." : "Check Open Levels"}</button></div>
    </div>
    {openLevels.length > 0 && <div className="migration-level-panel">
      <div className="migration-section-title"><span>2</span> Select V1 Open Level</div>
      <p className="migration-panel-note">Only these V1-open levels can be called. A recovered level is removed from this list permanently.</p>
      <div className="migration-level-grid">{openLevels.map((entry) => <label className="migration-special-import-toggle" key={entry.level}><input type="radio" name="recovery-level" value={entry.level} checked={selectedLevel === String(entry.level)} onChange={(event) => setSelectedLevel(event.target.value)} /><span><strong>Level {entry.level}</strong><small>V1 open · not imported in V3</small></span></label>)}</div>
      <div className="migration-actions"><button type="button" className="migration-primary-button" onClick={recover} disabled={recovering || !selectedLevel}>{recovering ? "Recovering..." : "Recover Selected Level Business"}<i className="bi bi-arrow-right" /></button></div>
    </div>}
    {message && <div className="migration-message">{message}</div>}
  </div></div>;
}
