import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getReadWalletAddress } from "../../../blockchain/readProvider";
import { BSC_TESTNET, WALLET_ADD_CHAIN_PARAMS } from "../../../blockchain/bscTestnetConfig";
import { ReferralNetworkAddress, V2ManualLegacyImporterAddress } from "../../../blockchain/address";
import V2RegistryABI from "../../../blockchain/v2ReferralRegistryABI";
import "./MigrationData.css";
import "../styles/style.css";

const IMPORTER_ABI = [
  "function owner() view returns(address)",
  "function migrationOperator(address) view returns(bool)",
  "function imported(address,uint256) view returns(bool)",
  "function importVerifiedPackage(address user,uint256 sourceIndex,uint256 amount,uint256 usedIncome,uint256 generatedSelfRoi,uint256 unpaidSelfRoi,uint256 originalPurchasedAt,uint256 unpaidDirectIncome)"
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

  useEffect(() => {
    getReadWalletAddress().then((address) => {
      setConnectedAddress(address);
      if (ethers.isAddress(address)) setValues((current) => ({ ...current, user: address }));
    });
  }, []);

  const setValue = (field, value) => setValues((current) => ({ ...current, [field]: value }));
  const useConnectedWallet = () => { if (ethers.isAddress(connectedAddress)) setValue("user", connectedAddress); };

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
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureBscTestnet();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const caller = await signer.getAddress();
      const registryUser = await new ethers.Contract(ReferralNetworkAddress, V2RegistryABI, provider).users(values.user);
      if (!Boolean(registryUser?.exists ?? registryUser?.[8])) throw new Error("Migrate this user's V2 structure first.");
      const importer = new ethers.Contract(V2ManualLegacyImporterAddress, IMPORTER_ABI, signer);
      const [owner, isOperator, alreadyImported] = await Promise.all([importer.owner(), importer.migrationOperator(caller), importer.imported(values.user, sourceIndex)]);
      if (caller.toLowerCase() !== owner.toLowerCase() && !isOperator) throw new Error("Connected wallet is not an authorised migration operator.");
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
    {message && <div className="migration-message">{message}</div>}
    <div className="migration-actions"><button className="migration-primary-button" onClick={callImport} disabled={importing}>{importing ? "Importing..." : "Call V2 Package Import"}<i className="bi bi-arrow-right" /></button></div>
  </div></div>;
}
