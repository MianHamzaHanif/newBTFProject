import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getReadWalletAddress } from "../../../blockchain/readProvider";
import { BSC_TESTNET, WALLET_ADD_CHAIN_PARAMS } from "../../../blockchain/bscTestnetConfig";
import { ReferralNetworkAddress, V2ManualLegacyImporterAddress, V2ManualLegacyLevelBridgeAddress, V2LegacyRankCheckpointAddress } from "../../../blockchain/address";
import V2RegistryABI from "../../../blockchain/v2ReferralRegistryABI";
import "./MigrationData.css";
import "../styles/style.css";

const IMPORTER_ABI = [
  "function owner() view returns(address)",
  "function migrationOperator(address) view returns(bool)",
  "function imported(address,uint256) view returns(bool)",
  "function pendingLevelImported(address,uint256) view returns(bool)",
  "function importVerifiedPendingLevelRoi(address user,uint256 level,uint256 amount)",
  "function importVerifiedPackage(address user,uint256 sourceIndex,uint256 amount,uint256 usedIncome,uint256 generatedSelfRoi,uint256 unpaidSelfRoi,uint256 originalPurchasedAt,uint256 unpaidDirectIncome)"
];
const LEVEL_BRIDGE_ABI = [
  "function owner() view returns(address)",
  "function migrationOperator(address) view returns(bool)",
  "function seedVerifiedLevels(address user,uint256[15] amounts)"
];
const RANK_CHECKPOINT_ABI = [
  "function baselineSet(address) view returns(bool)",
  "function beginLegacyRankCheckpoint(address user,uint256 powerLevel,uint256 rewardCount)",
  "function setLegacyPowerCheckpoint(address user,uint256 originalAchievedAt,uint256 nextInstallmentAt,uint256 paidInstallments,uint256 unpaidAmount)",
  "function setLegacyRewardCheckpoint(address user,uint256 index,uint256 originalAchievedAt,uint256 nextInstallmentAt,uint256 paidInstallments,uint256 unpaidAmount)"
];
const initialValues = { user: "", sourceIndex: "", amount: "", usedIncome: "", pendingSelfRoi: "", purchasedAt: "", pendingDirectIncome: "" };

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

function Field({ label, suffix, value, onChange, placeholder }) {
  return <div className="migration-field"><label>{label}</label><div className="migration-input-wrap"><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" />{suffix && <span>{suffix}</span>}</div></div>;
}

export default function MigrationData() {
  const [connectedAddress, setConnectedAddress] = useState("");
  const [values, setValues] = useState(initialValues);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [levelBusiness, setLevelBusiness] = useState(Array(15).fill("0"));
  const [levelRoi, setLevelRoi] = useState({ level: "", amount: "" });
  const [power, setPower] = useState({ powerLevel: "", rewardCount: "0", originalAchievedAt: "", nextInstallmentAt: "", paidInstallments: "", pendingAmount: "" });
  const [reward, setReward] = useState({ rankIndex: "", originalAchievedAt: "", nextInstallmentAt: "", paidInstallments: "", pendingAmount: "" });

  useEffect(() => {
    getReadWalletAddress().then((address) => {
      setConnectedAddress(address);
      if (ethers.isAddress(address)) setValues((current) => ({ ...current, user: address }));
    });
  }, []);

  const setValue = (field, value) => setValues((current) => ({ ...current, [field]: value }));
  const useConnectedWallet = () => { if (ethers.isAddress(connectedAddress)) setValue("user", connectedAddress); };
  const verifyUser = async (provider) => {
    if (!ethers.isAddress(values.user)) throw new Error("Enter a valid user wallet address.");
    const registryUser = await new ethers.Contract(ReferralNetworkAddress, V2RegistryABI, provider).users(values.user);
    if (!Boolean(registryUser?.exists ?? registryUser?.[8])) throw new Error("Migrate this user's V2 structure first.");
  };
  const authorisedContract = async (address, abi) => {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    await ensureBscTestnet();
    const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
    const caller = await signer.getAddress();
    const contract = new ethers.Contract(address, abi, signer);
    const [owner, isOperator] = await Promise.all([contract.owner(), contract.migrationOperator(caller)]);
    if (caller.toLowerCase() !== owner.toLowerCase() && !isOperator) throw new Error("Connected wallet is not an authorised migration operator.");
    return { contract, provider: signer.provider };
  };

  const callImport = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask or Trust Wallet is not available.");
      if (!ethers.isAddress(values.user)) throw new Error("Enter a valid user wallet address.");
      const sourceIndex = BigInt(values.sourceIndex);
      const amount = ethers.parseUnits(values.amount, 18);
      const usedIncome = ethers.parseUnits(values.usedIncome, 18);
      const pendingSelfRoi = ethers.parseUnits(values.pendingSelfRoi, 18);
      const purchasedAt = BigInt(values.purchasedAt);
      const pendingDirectIncome = ethers.parseUnits(values.pendingDirectIncome, 18);
      if (amount <= 0n || purchasedAt <= 0n || usedIncome < 0n || pendingSelfRoi < 0n || pendingDirectIncome < 0n) throw new Error("Enter valid amounts and purchase timestamp.");

      setImporting(true);
      setMessage("Checking V2 structure and migration authority...");
      const { contract: importer, provider } = await authorisedContract(V2ManualLegacyImporterAddress, IMPORTER_ABI);
      await verifyUser(provider);
      const alreadyImported = await importer.imported(values.user, sourceIndex);
      if (alreadyImported) throw new Error("This source package index has already been imported for this user.");

      // Pending-only migration: no additional historical Self ROI is added.
      const tx = await importer.importVerifiedPackage(values.user, sourceIndex, amount, usedIncome, pendingSelfRoi, pendingSelfRoi, purchasedAt, pendingDirectIncome);
      setMessage("Confirm the V2 package import transaction in your wallet.");
      await tx.wait();
      setMessage(`Package #${sourceIndex} imported successfully.`);
      window.dispatchEvent(new Event("btf:v2-data-changed"));
    } catch (error) {
      setMessage(error?.shortMessage || error?.reason || error?.message || "Package import failed.");
    } finally { setImporting(false); }
  };

  const seedLevelBusiness = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask or Trust Wallet is not available.");
      const amounts = levelBusiness.map((amount) => ethers.parseUnits(amount || "0", 18));
      setImporting(true);
      setMessage("Checking level-business migration authority...");
      const { contract: bridge, provider } = await authorisedContract(V2ManualLegacyLevelBridgeAddress, LEVEL_BRIDGE_ABI);
      await verifyUser(provider);
      const tx = await bridge.seedVerifiedLevels(values.user, amounts);
      setMessage("Confirm the V2 Level Business transaction in your wallet.");
      await tx.wait();
      setMessage("Level active business seeded successfully.");
      window.dispatchEvent(new Event("btf:v2-data-changed"));
    } catch (error) {
      setMessage(error?.shortMessage || error?.reason || error?.message || "Level business seed failed.");
    } finally { setImporting(false); }
  };

  const importPendingLevelRoi = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask or Trust Wallet is not available.");
      const displayLevel = BigInt(levelRoi.level);
      const amount = ethers.parseUnits(levelRoi.amount, 18);
      if (displayLevel < 1n || displayLevel > 15n || amount <= 0n) throw new Error("Enter a Level from 1 to 15 and a positive pending ROI amount.");
      const levelIndex = displayLevel - 1n;
      setImporting(true);
      setMessage("Checking pending Level ROI migration authority...");
      const { contract: importer, provider } = await authorisedContract(V2ManualLegacyImporterAddress, IMPORTER_ABI);
      await verifyUser(provider);
      if (await importer.pendingLevelImported(values.user, levelIndex)) throw new Error(`Level ${displayLevel} ROI is already imported.`);
      const tx = await importer.importVerifiedPendingLevelRoi(values.user, levelIndex, amount);
      setMessage(`Confirm Level ${displayLevel} ROI transaction in your wallet.`);
      await tx.wait();
      setMessage(`Pending Level ${displayLevel} ROI imported successfully.`);
      window.dispatchEvent(new Event("btf:v2-data-changed"));
    } catch (error) {
      setMessage(error?.shortMessage || error?.reason || error?.message || "Pending Level ROI import failed.");
    } finally { setImporting(false); }
  };

  const checkpointContract = async () => {
    if (!window.ethereum) throw new Error("MetaMask or Trust Wallet is not available.");
    await window.ethereum.request({ method: "eth_requestAccounts" });
    await ensureBscTestnet();
    const provider = new ethers.BrowserProvider(window.ethereum);
    await verifyUser(provider);
    return new ethers.Contract(V2LegacyRankCheckpointAddress, RANK_CHECKPOINT_ABI, await provider.getSigner());
  };

  const setPowerBaseline = async () => {
    try {
      const powerLevel = BigInt(power.powerLevel);
      const rewardCount = BigInt(power.rewardCount || "0");
      if (powerLevel < 1n || powerLevel > 9n || rewardCount < 0n || rewardCount > 12n) throw new Error("Power Rank must be 1–9 and Reward Count must be 0–12.");
      setImporting(true);
      const checkpoint = await checkpointContract();
      if (await checkpoint.baselineSet(values.user)) throw new Error("Power/Reward baseline is already set for this user.");
      const tx = await checkpoint.beginLegacyRankCheckpoint(values.user, powerLevel, rewardCount);
      setMessage("Confirm Power Rank Baseline transaction in your wallet.");
      await tx.wait();
      setMessage("Power Rank Baseline saved. Now set the pending Power schedule.");
    } catch (error) { setMessage(error?.shortMessage || error?.reason || error?.message || "Power baseline failed.");
    } finally { setImporting(false); }
  };

  const setPowerSchedule = async () => {
    try {
      const originalAchievedAt = BigInt(power.originalAchievedAt);
      const nextInstallmentAt = BigInt(power.nextInstallmentAt);
      const paidInstallments = BigInt(power.paidInstallments);
      const pendingAmount = ethers.parseUnits(power.pendingAmount, 18);
      if (originalAchievedAt <= 0n || nextInstallmentAt <= 0n || paidInstallments < 0n || pendingAmount <= 0n) throw new Error("Enter valid Power schedule values.");
      setImporting(true);
      const checkpoint = await checkpointContract();
      if (!await checkpoint.baselineSet(values.user)) throw new Error("Call Power Rank Baseline first.");
      const tx = await checkpoint.setLegacyPowerCheckpoint(values.user, originalAchievedAt, nextInstallmentAt, paidInstallments, pendingAmount);
      setMessage("Confirm Pending Power Schedule transaction in your wallet.");
      await tx.wait();
      setMessage("Pending Power Income schedule saved successfully.");
      window.dispatchEvent(new Event("btf:v2-data-changed"));
    } catch (error) { setMessage(error?.shortMessage || error?.reason || error?.message || "Power schedule failed.");
    } finally { setImporting(false); }
  };

  const setRewardSchedule = async () => {
    try {
      const rankIndex = BigInt(reward.rankIndex);
      const originalAchievedAt = BigInt(reward.originalAchievedAt);
      const nextInstallmentAt = BigInt(reward.nextInstallmentAt);
      const paidInstallments = BigInt(reward.paidInstallments);
      const pendingAmount = ethers.parseUnits(reward.pendingAmount, 18);
      if (rankIndex < 1n || rankIndex > 12n || originalAchievedAt <= 0n || nextInstallmentAt <= 0n || paidInstallments < 0n || pendingAmount <= 0n) throw new Error("Enter valid Reward rank and schedule values.");
      setImporting(true);
      const checkpoint = await checkpointContract();
      if (!await checkpoint.baselineSet(values.user)) throw new Error("Call Power/Reward Rank Baseline first.");
      const tx = await checkpoint.setLegacyRewardCheckpoint(values.user, rankIndex, originalAchievedAt, nextInstallmentAt, paidInstallments, pendingAmount);
      setMessage("Confirm Pending Reward Schedule transaction in your wallet.");
      await tx.wait();
      setMessage(`Pending Reward R${rankIndex} schedule saved successfully.`);
      window.dispatchEvent(new Event("btf:v2-data-changed"));
    } catch (error) { setMessage(error?.shortMessage || error?.reason || error?.message || "Reward schedule failed.");
    } finally { setImporting(false); }
  };

  return <div className="page-container migration-page"><div className="migration-form-shell">
    <div className="migration-form-heading"><div className="migration-form-icon"><i className="bi bi-arrow-left-right" /></div><div><h1>Migration Data</h1><p>Enter verified V1 values and import one active package into V2.</p></div></div>
    <div className="migration-section-title"><span>1</span> Beneficiary</div>
    <div className="migration-address-row"><div className="migration-field migration-field-wide"><label htmlFor="migration-user">User Wallet Address</label><input id="migration-user" value={values.user} onChange={(event) => setValue("user", event.target.value)} placeholder="0x..." autoComplete="off" /></div><button className="migration-secondary-button" onClick={useConnectedWallet} disabled={!connectedAddress || importing}>Use Connected Wallet</button></div>
    {connectedAddress && <p className="migration-connected">Connected caller: {connectedAddress}</p>}
    <div className="migration-section-title"><span>2</span> Package & Income Values</div>
    <div className="migration-input-grid">
      <Field label="Source Package Index" value={values.sourceIndex} onChange={(value) => setValue("sourceIndex", value)} placeholder="e.g. 2" />
      <Field label="Package Amount" suffix="USDT" value={values.amount} onChange={(value) => setValue("amount", value)} placeholder="e.g. 25" />
      <Field label="Used Income" suffix="USDT" value={values.usedIncome} onChange={(value) => setValue("usedIncome", value)} placeholder="e.g. 71.7875" />
      <Field label="Original Purchase Timestamp" value={values.purchasedAt} onChange={(value) => setValue("purchasedAt", value)} placeholder="Unix timestamp" />
      <Field label="Pending Self ROI to Add" suffix="USDT" value={values.pendingSelfRoi} onChange={(value) => setValue("pendingSelfRoi", value)} placeholder="e.g. 3.2125" />
      <Field label="Pending Direct Income to Add" suffix="USDT" value={values.pendingDirectIncome} onChange={(value) => setValue("pendingDirectIncome", value)} placeholder="Enter 0 if already added" />
    </div>
    <div className="migration-notice"><i className="bi bi-info-circle" /> Pending Direct Income sirf ek package par add karain. Next package import ke liye is field mein <strong>0</strong> rakhein.</div>
    <div className="migration-actions"><button className="migration-primary-button" onClick={callImport} disabled={importing}>{importing ? "Importing..." : "Call V2 Package Import"}<i className="bi bi-arrow-right" /></button></div>
    <div className="migration-level-panel">
      <div className="migration-section-title"><span>3</span> Active Level Business</div>
      <p className="migration-panel-note">Enter only active V1 package business for every level. This is a one-time seed and requires the package import first.</p>
      <div className="migration-level-grid">{levelBusiness.map((amount, index) => <Field key={index} label={`Level ${index + 1} Business`} suffix="USDT" value={amount} onChange={(value) => setLevelBusiness((current) => current.map((entry, position) => position === index ? value : entry))} placeholder="0" />)}</div>
      <div className="migration-actions"><button className="migration-secondary-action" onClick={seedLevelBusiness} disabled={importing}>{importing ? "Processing..." : "Call V2 Level Business Seed"}</button></div>
    </div>
    <div className="migration-level-panel">
      <div className="migration-section-title"><span>4</span> Pending Level ROI</div>
      <p className="migration-panel-note">Add one V1 pending Level ROI at a time. UI Level 1 automatically sends contract index 0.</p>
      <div className="migration-roi-row"><Field label="Level Number" value={levelRoi.level} onChange={(value) => setLevelRoi((current) => ({ ...current, level: value }))} placeholder="1 to 15" /><Field label="Pending Level ROI" suffix="USDT" value={levelRoi.amount} onChange={(value) => setLevelRoi((current) => ({ ...current, amount: value }))} placeholder="e.g. 59.55" /></div>
      <div className="migration-actions"><button className="migration-secondary-action" onClick={importPendingLevelRoi} disabled={importing}>{importing ? "Processing..." : "Call V2 Pending Level ROI"}</button></div>
    </div>
    <div className="migration-level-panel">
      <div className="migration-section-title"><span>5</span> Power Income Checkpoint</div>
      <p className="migration-panel-note">First save the achieved Power rank, then save only the current V1 pending Power amount as the schedule.</p>
      <div className="migration-roi-row"><Field label="Power Rank" value={power.powerLevel} onChange={(value) => setPower((current) => ({ ...current, powerLevel: value }))} placeholder="P1 = 1" /><Field label="Reward Rank Count" value={power.rewardCount} onChange={(value) => setPower((current) => ({ ...current, rewardCount: value }))} placeholder="0 if no Reward rank" /></div>
      <div className="migration-actions"><button className="migration-secondary-action" onClick={setPowerBaseline} disabled={importing}>{importing ? "Processing..." : "Call Power Rank Baseline"}</button></div>
      <div className="migration-input-grid migration-power-grid"><Field label="Original Power Achieved Timestamp" value={power.originalAchievedAt} onChange={(value) => setPower((current) => ({ ...current, originalAchievedAt: value }))} placeholder="Unix timestamp" /><Field label="Next Installment Timestamp" value={power.nextInstallmentAt} onChange={(value) => setPower((current) => ({ ...current, nextInstallmentAt: value }))} placeholder="Future Unix timestamp" /><Field label="Already Paid Installments" value={power.paidInstallments} onChange={(value) => setPower((current) => ({ ...current, paidInstallments: value }))} placeholder="e.g. 1" /><Field label="Current Pending Power Income" suffix="USDT" value={power.pendingAmount} onChange={(value) => setPower((current) => ({ ...current, pendingAmount: value }))} placeholder="e.g. 100" /></div>
      <div className="migration-actions"><button className="migration-primary-button" onClick={setPowerSchedule} disabled={importing}>{importing ? "Processing..." : "Call Pending Power Schedule"}<i className="bi bi-lightning-charge" /></button></div>
    </div>
    <div className="migration-level-panel">
      <div className="migration-section-title"><span>6</span> Reward Income Checkpoint</div>
      <p className="migration-panel-note">Enter only a V1 Reward rank that is achieved and still has pending income. Reward Rank Count in the baseline must be equal to or higher than this Reward rank.</p>
      <div className="migration-input-grid migration-power-grid"><Field label="Reward Rank Index" value={reward.rankIndex} onChange={(value) => setReward((current) => ({ ...current, rankIndex: value }))} placeholder="R1 = 1" /><Field label="Original Reward Achieved Timestamp" value={reward.originalAchievedAt} onChange={(value) => setReward((current) => ({ ...current, originalAchievedAt: value }))} placeholder="Unix timestamp" /><Field label="Next Reward Installment Timestamp" value={reward.nextInstallmentAt} onChange={(value) => setReward((current) => ({ ...current, nextInstallmentAt: value }))} placeholder="Future Unix timestamp" /><Field label="Already Paid Installments" value={reward.paidInstallments} onChange={(value) => setReward((current) => ({ ...current, paidInstallments: value }))} placeholder="e.g. 0" /><Field label="Current Pending Reward Income" suffix="USDT" value={reward.pendingAmount} onChange={(value) => setReward((current) => ({ ...current, pendingAmount: value }))} placeholder="e.g. 250" /></div>
      <div className="migration-actions"><button className="migration-primary-button" onClick={setRewardSchedule} disabled={importing}>{importing ? "Processing..." : "Call Pending Reward Schedule"}<i className="bi bi-gift" /></button></div>
    </div>
    {message && <div className="migration-message">{message}</div>}
  </div></div>;
}
