import { TableCell } from "@mui/material";
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import { getReadWalletAddress } from "../../../blockchain/readProvider";
import { canAccessMigration } from "../../../blockchain/migrationAccess";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import { BSC_MAINNET, WALLET_ADD_CHAIN_PARAMS } from "../../../blockchain/bscMainnetConfig";
import { ReferralNetworkAddress, PackageManagerAddress, V2LedgerAddress, V2ManualLegacyImporterAddress, V2VerifiedLegacyImporterAddress, V2VerifiedLegacyRankImporterAddress, V2ManualLegacyLevelBridgeAddress } from "../../../blockchain/address";
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
const VERIFIED_IMPORTER_ABI = [
  "function imported(address) view returns(bool)",
  "function fundingSource() view returns(address)",
  "function importPackage(address user,uint256 sourceIndex)",
  "function importPackages(address user,uint256[] sourceIndices)",
  "function importPackageWithV2SelfRoi(address user,uint256 sourceIndex)",
  "function importPackagesWithV2SelfRoi(address user,uint256[] sourceIndices)",
  "function legacyLevelRoiImported(address) view returns(bool)",
  "function importPendingLevelRoiFromV1(address user,uint256[15] amounts)"
];
const VERIFIED_RANK_IMPORTER_ABI = ["function importVerifiedRanks(address user)"];
const MANAGER_LEGACY_RECOVERY_ABI = [
  "function setLegacyPendingLevelRoiBatch(address user,uint256[15] amounts)",
];
const V1_RANK_MANAGER_ABI = [
  "function powerIncomeModule() view returns(address)",
  "function rewardIncomeModule() view returns(address)",
  "function oneDay() view returns(uint256)",
  "function totalOverflowByType(address user,uint8 incomeType) view returns(uint256)"
];
const V1_POWER_READER_ABI = [
  "function activePowerLevel(address user) view returns(uint256)",
  "function powerLevelStartedAt(address user) view returns(uint256)",
  "function powerClaimedCount(address user) view returns(uint256)"
];
const V1_REWARD_READER_ABI = [
  "function rewardAchievedAt(address user,uint256 index) view returns(uint256)",
  "function rewardClaimedAmountByIndex(address user,uint256 index) view returns(uint256)"
];
const V1_PACKAGE_READER_ABI = [
  "function getStakeHistoryLength(address user) view returns(uint256)",
  "function userStakeHistory(address user,uint256 index) view returns(uint256 packageValue,uint256 usdtAmount,uint256 tokenAmount,uint256 burnAmount,uint256 ownerLockAmount,uint256 userLockAmount,uint256 roiClaimed,uint256 timestamp)",
  "function getStakeIncomeStatus(address user,uint256 index) view returns(uint256 incomeLimit,uint256 usedIncome,uint256 remainingIncome,bool completed)",
  "function getStakeRoiInfo(address user,uint256 index) view returns(uint256 principal,uint256 maxRoi,uint256 totalAccrued,uint256 claimed,uint256 claimable)",
  "function pendingDirectIncomeToken(address user) view returns(uint256)"
];
const V1_REFERRAL_READER_ABI = [
  "function getLevelUsersLength(address upline,uint256 level) view returns(uint256)",
  "function getLevelUserAt(address upline,uint256 level,uint256 index) view returns(address)",
  "function isLevelOpen(address user,uint256 level) view returns(bool)",
  "function getAllLevelRoiClaimableFor(address upline) view returns(uint256[15])"
];
const REGISTRY_MIGRATION_ABI = ["function isMigrationAuthority(address) view returns(bool)"];
const V1_STRUCTURE_READER_ABI = [
  "function nextUserId() view returns(uint256)",
  "function idToAddress(uint256) view returns(address)",
  "function users(address) view returns(uint256 id,address referral,uint256 registeredAt,uint256 totalTeam,uint256 totalTeamDeposit,uint256 selfDeposit,uint256 totalTeamStakeToken,uint256 selfStakeToken,bool exists)",
];
const V2_STRUCTURE_MIGRATION_ABI = [
  "function migrateUser(address user)",
  "function migrated(address) view returns(bool)",
  "function legacyLevelSeeded(address) view returns(bool)",
  "function users(address) view returns(uint256 id,address referral,uint256 registeredAt,uint256 totalTeam,uint256 totalTeamDeposit,uint256 selfDeposit,uint256 totalTeamStakeToken,uint256 selfStakeToken,bool exists)",
  "function isMigrationAuthority(address) view returns(bool)",
];
const V2_LEDGER_MIGRATION_ABI = [
  "function getUserIncomeHistoryLengthByType(address user,uint8 incomeType) view returns(uint256)",
];
const NEXT_USER_SCAN_BATCH_SIZE = 10;
const NEAR_LIMIT_THRESHOLD = 10n * 10n ** 18n;
// Tree registration is complete/not required for this deployment. Keep the
// implementation available for a future controlled migration, but hide it
// from the operational UI.
const SHOW_TREE_REGISTRATION_RUNNER = false;
const LEVEL_BRIDGE_ABI = [
  "function owner() view returns(address)",
  "function migrationOperator(address) view returns(bool)",
  "function seedVerifiedLevels(address user,uint256[15] amounts)"
];
// The beneficiary address and V1 package index are the only values supplied
// for package migration. Income values are verified and read from V1 on-chain.
const initialValues = { user: "", sourceIndex: "" };

const normalizeWalletAddress = (value) => {
  const trimmed = value.trim();
  // MetaMask/Explorer copies can have mixed-case but non-checksummed text.
  // Canonicalize it before ethers validates or sends it to a contract.
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return trimmed;
  try {
    return ethers.getAddress(trimmed.toLowerCase());
  } catch {
    return trimmed;
  }
};

const resolvedWalletAddress = (value) => {
  const normalized = normalizeWalletAddress(value);
  if (!ethers.isAddress(normalized)) throw new Error("Enter a valid beneficiary wallet address.");
  // Lowercase is always accepted by ethers and EVM ABI encoding, including
  // when a previously persisted UI value had invalid mixed-case checksum.
  return normalized.toLowerCase();
};

const formatUsdt = (value) => {
  try {
    const [whole, decimals = ""] = ethers.formatUnits(value ?? 0n, 18).split(".");
    return `${whole}.${(decimals + "0000").slice(0, 4)}`;
  } catch { return "0.0000"; }
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

function Field({ label, suffix, value, onChange, placeholder, readOnly = false }) {
  return <div className="migration-field"><label>{label}</label><div className="migration-input-wrap"><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" readOnly={readOnly} />{suffix && <span>{suffix}</span>}</div></div>;
}

function createV1ReadProvider() {
  const request = new ethers.FetchRequest(V1_MAINNET.rpcUrl);
  request.timeout = 30_000;
  // Public V1 endpoints can drop oversized JSON-RPC batches.  The scanner
  // controls concurrency itself, so send one RPC call per HTTP request.
  return new ethers.JsonRpcProvider(request, V1_MAINNET.chainId, {
    staticNetwork: true,
    batchMaxCount: 1,
    batchStallTime: 0,
  });
}

export default function MigrationData() {
  const [connectedAddress, setConnectedAddress] = useState("");
  const [accessChecked, setAccessChecked] = useState(false);
  const [canViewMigration, setCanViewMigration] = useState(false);
  const [values, setValues] = useState(initialValues);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [checkingActivePackages, setCheckingActivePackages] = useState(false);
  const [hasCheckedActivePackages, setHasCheckedActivePackages] = useState(false);
  const [activeV1Packages, setActiveV1Packages] = useState([]);
  const [activeV1DirectIncome, setActiveV1DirectIncome] = useState(0n);
  const [activePackageCheckError, setActivePackageCheckError] = useState("");
  const [includeV1IncomeAndV2SelfRoi, setIncludeV1IncomeAndV2SelfRoi] = useState(false);
  const [levelBusiness, setLevelBusiness] = useState(Array(15).fill("0"));
  const [refreshingLevelBusiness, setRefreshingLevelBusiness] = useState(false);
  const [levelBusinessRefreshError, setLevelBusinessRefreshError] = useState("");
  // Read this independently of the operator action.  A legacy Level
  // snapshot is immutable and a second seed always reverts on-chain.
  const [legacyLevelSeeded, setLegacyLevelSeeded] = useState(null);
  const [pendingLevelRoi, setPendingLevelRoi] = useState(Array(15).fill("0"));
  const [openV1Levels, setOpenV1Levels] = useState(Array(15).fill(false));
  const [refreshingPendingLevelRoi, setRefreshingPendingLevelRoi] = useState(false);
  const [pendingLevelRoiError, setPendingLevelRoiError] = useState("");
  const [pendingLevelRoiRefreshed, setPendingLevelRoiRefreshed] = useState(false);
  const [checkingV1Ranks, setCheckingV1Ranks] = useState(false);
  const [v1RankCheckError, setV1RankCheckError] = useState("");
  const [v1RankSnapshot, setV1RankSnapshot] = useState(null);
  const [nextV1Id, setNextV1Id] = useState("1");
  const [nextV1User, setNextV1User] = useState(null);
  const [loadingNextV1User, setLoadingNextV1User] = useState(false);
  const [nearLimitUsers, setNearLimitUsers] = useState([]);
  const [refreshingNearLimitUsers, setRefreshingNearLimitUsers] = useState(false);
  const [nearLimitUsersError, setNearLimitUsersError] = useState("");
  const [nearLimitUsersScanned, setNearLimitUsersScanned] = useState(0);
  const verifiedPackageImport = ethers.isAddress(V2VerifiedLegacyImporterAddress) && V2VerifiedLegacyImporterAddress !== ethers.ZeroAddress;
  const verifiedRankImport = ethers.isAddress(V2VerifiedLegacyRankImporterAddress) && V2VerifiedLegacyRankImporterAddress !== ethers.ZeroAddress;

  useEffect(() => {
    getReadWalletAddress().then(async (address) => {
      setConnectedAddress(address);
      setCanViewMigration(await canAccessMigration(address));
      setAccessChecked(true);
    });
  }, []);

  const setValue = (field, value) => setValues((current) => ({
    ...current,
    // Wallet addresses are commonly pasted with a trailing space/newline.
    // Keep the beneficiary field clean before any V1 refresh/import check.
    [field]: field === "user" ? normalizeWalletAddress(value) : value,
  }));

  useEffect(() => {
    let cancelled = false;
    const user = normalizeWalletAddress(values.user);
    if (!ethers.isAddress(user)) {
      setLegacyLevelSeeded(null);
      return () => { cancelled = true; };
    }

    const registry = new ethers.Contract(
      ReferralNetworkAddress,
      V2_STRUCTURE_MIGRATION_ABI,
      createV1ReadProvider(),
    );
    registry.legacyLevelSeeded(user)
      .then((seeded) => { if (!cancelled) setLegacyLevelSeeded(seeded); })
      // The action itself still performs an authoritative preflight.  Keep
      // the button usable if a public read endpoint is temporarily offline.
      .catch(() => { if (!cancelled) setLegacyLevelSeeded(null); });
    return () => { cancelled = true; };
  }, [values.user]);
  const verifyUser = async (provider, user = resolvedWalletAddress(values.user)) => {
    const registryUser = await new ethers.Contract(ReferralNetworkAddress, V2RegistryABI, provider).users(user);
    if (!Boolean(registryUser?.exists ?? registryUser?.[8])) throw new Error("Migrate this user's V2 structure first.");
  };
  const authorisedContract = async (address, abi) => {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    await ensureBscMainnet();
    const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
    const caller = await signer.getAddress();
    const contract = new ethers.Contract(address, abi, signer);
    const isOperator = await contract.migrationOperator(caller);
    if (!isOperator) throw new Error("Connected wallet is not authorised by the V2 Registry/DAO for migration.");
    return { contract, provider: signer.provider, caller };
  };

  const authorisedVerifiedImporter = async () => {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (BigInt(chainId) !== 56n) {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
    }
    const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
    const caller = await signer.getAddress();
    const registry = new ethers.Contract(ReferralNetworkAddress, REGISTRY_MIGRATION_ABI, signer.provider);
    if (!await registry.isMigrationAuthority(caller)) throw new Error("Connected wallet is not authorised by the V2 Registry/DAO for migration.");
    return { contract: new ethers.Contract(V2VerifiedLegacyImporterAddress, VERIFIED_IMPORTER_ABI, signer), provider: signer.provider };
  };

  const packageFundingErrorMessage = async (beneficiary, sourceIndexes, error) => {
    const rawMessage = error?.shortMessage || error?.reason || error?.message || "Package import failed.";
    if (!/BEP20:\s*transfer amount exceeds balance/i.test(rawMessage)) return rawMessage;

    try {
      const v1 = new ethers.Contract(V1_MAINNET.packageManager, V1_PACKAGE_READER_ABI, createV1ReadProvider());
      const requiredAmount = (await Promise.all(sourceIndexes.map(async (sourceIndex) => {
        const status = await v1.getStakeIncomeStatus(beneficiary, sourceIndex);
        return BigInt(status?.remainingIncome ?? status?.[2] ?? 0n);
      }))).reduce((total, amount) => total + amount, 0n);
      const v2ReadProvider = new ethers.BrowserProvider(window.ethereum);
      const importer = new ethers.Contract(V2VerifiedLegacyImporterAddress, VERIFIED_IMPORTER_ABI, v2ReadProvider);
      const fundingWallet = await importer.fundingSource();
      const requiredUsdt = ethers.formatUnits(requiredAmount, 18);
      return `${rawMessage} Funding wallet (owner): ${fundingWallet}. It must hold at least ${requiredUsdt} USDT and approve the Verified V1 Package Importer (${V2VerifiedLegacyImporterAddress}) to spend at least ${requiredUsdt} USDT. The importer transfers this amount to the V2 ledger to reserve the user's remaining package income.`;
    } catch {
      return `${rawMessage} The importer's funding wallet (owner) must have enough USDT and approve the Verified V1 Package Importer (${V2VerifiedLegacyImporterAddress}) for the package's remaining income amount.`;
    }
  };

  const loadNextV1User = async (startAt = nextV1Id) => {
    try {
      const startId = BigInt(String(startAt).trim());
      if (startId < 0n) throw new Error("V1 User ID must be zero or greater.");
      setLoadingNextV1User(true);
      setMessage("Reading the next V1 user and checking the V2 referral tree...");
      const v1 = new ethers.Contract(V1_MAINNET.referralNetwork, V1_STRUCTURE_READER_ABI, createV1ReadProvider());
      const v2 = new ethers.Contract(ReferralNetworkAddress, V2_STRUCTURE_MIGRATION_ABI, createV1ReadProvider());
      const endId = await v1.nextUserId();

      // First read only V1 IDs and their V2 migrated flags in small parallel
      // batches. Previously every ID was checked serially, so starting at 1
      // waited through all already-migrated users before anything appeared.
      for (let batchStart = startId; batchStart < endId; batchStart += BigInt(NEXT_USER_SCAN_BATCH_SIZE)) {
        const batchEnd = batchStart + BigInt(NEXT_USER_SCAN_BATCH_SIZE) > endId
          ? endId
          : batchStart + BigInt(NEXT_USER_SCAN_BATCH_SIZE);
        const ids = Array.from({ length: Number(batchEnd - batchStart) }, (_, offset) => batchStart + BigInt(offset));
        const users = await Promise.all(ids.map((id) => v1.idToAddress(id)));
        const migratedFlags = await Promise.all(users.map((user) => v2.migrated(user)));
        const candidateIndex = migratedFlags.findIndex((migrated) => !migrated);
        if (candidateIndex === -1) continue;

        const id = ids[candidateIndex];
        const user = users[candidateIndex];
        const v1User = await v1.users(user);
        if (!Boolean(v1User.exists ?? v1User[8])) throw new Error(`V1 ID ${id} is invalid. Migration stopped.`);

        const referral = v1User.referral ?? v1User[1];
        if (id !== 0n) {
          const v2Referral = await v2.users(referral);
          if (!Boolean(v2Referral.exists ?? v2Referral[8])) {
            throw new Error(`V1 ID ${id} cannot be migrated yet: its V1 referrer ${referral} is not present in V2. Migrate the parent first.`);
          }
        }

        const candidate = { id, user, referral, registeredAt: v1User.registeredAt ?? v1User[2] };
        setNextV1User(candidate);
        setNextV1Id(id.toString());
        setValues((current) => ({ ...current, user, sourceIndex: "" }));
        setActiveV1Packages([]);
        setHasCheckedActivePackages(false);
        setPendingLevelRoiRefreshed(false);
        setV1RankSnapshot(null);
        setMessage(`V1 ID ${id} loaded. Review its wallet/referrer, then press Migrate This V1 User.`);
        return candidate;
      }

      setNextV1User(null);
      setMessage("No unmigrated V1 user remains from this ID onward.");
      return null;
    } catch (error) {
      setNextV1User(null);
      setMessage(error?.shortMessage || error?.reason || error?.message || "Could not load the next V1 user.");
      return null;
    } finally {
      setLoadingNextV1User(false);
    }
  };

  const migrateNextV1User = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask or Trust Wallet is not available.");
      const candidate = nextV1User || await loadNextV1User();
      if (!candidate) return;

      setImporting(true);
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureBscMainnet();
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const caller = await signer.getAddress();
      const registry = new ethers.Contract(ReferralNetworkAddress, V2_STRUCTURE_MIGRATION_ABI, signer);
      if (!await registry.isMigrationAuthority(caller)) throw new Error("Connected wallet is not authorised as a V2 migration operator.");
      if (await registry.migrated(candidate.user)) throw new Error(`V1 ID ${candidate.id} is already migrated. Press Load Next V1 User.`);

      // Some injected wallet RPCs fail their own eth_estimateGas before the
      // confirmation dialog. Estimate against the public Mainnet reader and
      // supply a 25% buffer so MetaMask only has to submit the prepared call.
      const readRegistry = new ethers.Contract(
        ReferralNetworkAddress,
        V2_STRUCTURE_MIGRATION_ABI,
        createV1ReadProvider(),
      );
      const estimatedGas = await readRegistry.migrateUser.estimateGas(candidate.user, { from: caller });
      const gasLimit = (estimatedGas * 125n) / 100n + 25_000n;
      setMessage(`Confirm V1 ID ${candidate.id} structure migration in your wallet. No package or income is imported by this step.`);
      const tx = await registry.migrateUser(candidate.user, { gasLimit });
      await tx.wait();
      if (!await registry.migrated(candidate.user)) throw new Error("Transaction confirmed but the V2 Registry did not mark this user as migrated.");

      window.dispatchEvent(new Event("btf:v2-data-changed"));
      setNextV1Id((candidate.id + 1n).toString());
      setNextV1User(null);
      setMessage(`V1 ID ${candidate.id} migrated successfully. Loading the next V1 user...`);
      await loadNextV1User(candidate.id + 1n);
    } catch (error) {
      // Keep the displayed candidate intact. The operator can fix the issue
      // and retry; no later V1 user is loaded after an error.
      setMessage(error?.shortMessage || error?.reason || error?.message || "V1 structure migration failed. Process stopped on this user.");
    } finally {
      setImporting(false);
    }
  };

  const callImport = async () => {
    let beneficiary = "";
    let sourceIndexes = [];
    try {
      if (!window.ethereum) throw new Error("MetaMask or Trust Wallet is not available.");
      beneficiary = resolvedWalletAddress(values.user);
      if (!verifiedPackageImport) throw new Error("Verified V1 Package Importer address is not configured for this deployment.");
      sourceIndexes = values.sourceIndex.split(",").map((value) => BigInt(value.trim()));
      if (!sourceIndexes.length || sourceIndexes.some((value, index) => value < 0n || (index > 0 && value <= sourceIndexes[index - 1]))) {
        throw new Error("Enter one or more ascending V1 package indexes, for example 2 or 6,7.");
      }
      setImporting(true);
      setMessage("Reading the V1 package snapshot and checking Registry/DAO authority...");
      const { contract: importer } = await authorisedVerifiedImporter();
      // Package snapshots are deliberately imported by the authorised
      // migration wallet for the beneficiary typed above. Do not block this
      // operator action in the UI by requiring the beneficiary to connect or
      // by doing a separate V2-tree preflight here: the importer/manager is
      // the source of truth and will return its exact on-chain reason if a
      // prerequisite is still missing.
      // `imported(user)` only means at least one V1 index was imported. A
      // later correction may still need to add a different active V1 source
      // index, so duplicate prevention is enforced on-chain per index.
      const tx = includeV1IncomeAndV2SelfRoi
        ? sourceIndexes.length === 1
          ? await importer.importPackageWithV2SelfRoi(beneficiary, sourceIndexes[0])
          : await importer.importPackagesWithV2SelfRoi(beneficiary, sourceIndexes)
        : sourceIndexes.length === 1
          ? await importer.importPackage(beneficiary, sourceIndexes[0])
          : await importer.importPackages(beneficiary, sourceIndexes);
      setMessage(includeV1IncomeAndV2SelfRoi
        ? "Confirm the V1-withdrawal-disabled package import. Pending Direct/Self ROI will migrate and future V2 Self ROI will start."
        : "Confirm the normal V1-to-V2 package import. V1 pending Direct/Self ROI and future legacy Self ROI are excluded.");
      await tx.wait();
      setMessage(`Verified V1 package index ${sourceIndexes.join(", ")} imported successfully${includeV1IncomeAndV2SelfRoi ? " with V1 income and V2 Self ROI continuation" : " (normal import)"}.`);
      window.dispatchEvent(new Event("btf:v2-data-changed"));
    } catch (error) {
      setMessage(await packageFundingErrorMessage(beneficiary, sourceIndexes, error));
    } finally { setImporting(false); }
  };

  const checkActiveV1Packages = async () => {
    if (!ethers.isAddress(values.user)) {
      setActiveV1Packages([]);
      setActivePackageCheckError("Pehle valid beneficiary wallet address enter karein.");
      return;
    }

    try {
      setCheckingActivePackages(true);
      setHasCheckedActivePackages(true);
      setActivePackageCheckError("");
      setActiveV1Packages([]);
      setActiveV1DirectIncome(0n);
      const provider = createV1ReadProvider();
      const legacy = new ethers.Contract(V1_MAINNET.packageManager, V1_PACKAGE_READER_ABI, provider);
      const [historyLengthRaw, currentDirectIncome] = await Promise.all([
        legacy.getStakeHistoryLength(values.user),
        legacy.pendingDirectIncomeToken(values.user),
      ]);
      const historyLength = Number(historyLengthRaw);
      const packages = await Promise.all(Array.from({ length: historyLength }, async (_, index) => {
        const [stake, income, roi] = await Promise.all([
          legacy.userStakeHistory(values.user, index),
          legacy.getStakeIncomeStatus(values.user, index),
          legacy.getStakeRoiInfo(values.user, index),
        ]);
        const packageValue = stake.packageValue ?? stake[0];
        const incomeLimit = income.incomeLimit ?? income[0];
        const usedIncome = income.usedIncome ?? income[1];
        const remainingIncome = income.remainingIncome ?? income[2];
        const completed = income.completed ?? income[3];
        const selfRoiMaximum = roi.maxRoi ?? roi[1];
        const selfRoiGenerated = roi.totalAccrued ?? roi[2];
        const selfRoiClaimed = roi.claimed ?? roi[3];
        const selfRoiClaimable = roi.claimable ?? roi[4];
        const active = packageValue > 0n && !completed && usedIncome < incomeLimit && remainingIncome === incomeLimit - usedIncome;
        return active ? {
          index,
          packageValue,
          incomeLimit,
          usedIncome,
          remainingIncome,
          selfRoiMaximum,
          selfRoiGenerated,
          selfRoiClaimed,
          selfRoiClaimable,
        } : null;
      }));
      setActiveV1DirectIncome(currentDirectIncome);
      setActiveV1Packages(packages.filter(Boolean));
    } catch (error) {
      setActivePackageCheckError(error?.shortMessage || error?.message || "V1 active packages read nahi ho sake.");
    } finally {
      setCheckingActivePackages(false);
    }
  };

  const seedLevelBusiness = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask or Trust Wallet is not available.");
      const beneficiary = resolvedWalletAddress(values.user);
      const amounts = levelBusiness.map((amount) => ethers.parseUnits(amount || "0", 18));
      setImporting(true);
      setMessage("Checking level-business migration authority...");
      const { contract: bridge, provider, caller } = await authorisedContract(V2ManualLegacyLevelBridgeAddress, LEVEL_BRIDGE_ABI);
      await verifyUser(provider, beneficiary);
      const registry = new ethers.Contract(ReferralNetworkAddress, V2_STRUCTURE_MIGRATION_ABI, provider);
      if (await registry.legacyLevelSeeded(beneficiary)) {
        throw new Error("Level business is already seeded for this user. Do not call it again.");
      }

      // Estimate with the public Mainnet reader first. This avoids injected
      // wallet gas-estimation failures that leave MetaMask without a visible
      // confirmation popup. MetaMask receives only the prepared transaction.
      const readBridge = new ethers.Contract(
        V2ManualLegacyLevelBridgeAddress,
        LEVEL_BRIDGE_ABI,
        createV1ReadProvider(),
      );
      const estimatedGas = await readBridge.seedVerifiedLevels.estimateGas(
        beneficiary,
        amounts,
        { from: caller },
      );
      const gasLimit = (estimatedGas * 125n) / 100n + 25_000n;
      setMessage("Confirm the V2 Level Business transaction in your wallet.");
      const tx = await bridge.seedVerifiedLevels(beneficiary, amounts, { gasLimit });
      await tx.wait();
      setMessage("Level active business seeded successfully.");
      window.dispatchEvent(new Event("btf:v2-data-changed"));
    } catch (error) {
      setMessage(error?.shortMessage || error?.reason || error?.message || "Level business seed failed.");
    } finally { setImporting(false); }
  };

  const refreshV1LevelBusiness = async () => {
    if (!ethers.isAddress(values.user)) {
      setLevelBusinessRefreshError("Pehle valid beneficiary wallet address enter karein.");
      return;
    }

    try {
      setRefreshingLevelBusiness(true);
      setLevelBusinessRefreshError("");
      const provider = createV1ReadProvider();
      const referral = new ethers.Contract(V1_MAINNET.referralNetwork, V1_REFERRAL_READER_ABI, provider);
      const packageManager = new ethers.Contract(V1_MAINNET.packageManager, V1_PACKAGE_READER_ABI, provider);
      const totals = Array(15).fill(0n);

      // Small batches keep large V1 teams from overwhelming the public RPC.
      const inBatches = async (items, callback, size = 20) => {
        for (let start = 0; start < items.length; start += size) {
          await Promise.all(items.slice(start, start + size).map(callback));
        }
      };

      for (let level = 0; level < 15; level += 1) {
        const count = Number(await referral.getLevelUsersLength(values.user, level));
        const positions = Array.from({ length: count }, (_, index) => index);
        const downlines = [];
        await inBatches(positions, async (index) => {
          downlines[index] = await referral.getLevelUserAt(values.user, level, index);
        });

        await inBatches(downlines, async (downline) => {
          const stakeCount = Number(await packageManager.getStakeHistoryLength(downline));
          const stakeIndexes = Array.from({ length: stakeCount }, (_, index) => index);
          await inBatches(stakeIndexes, async (stakeIndex) => {
            const [stake, income] = await Promise.all([
              packageManager.userStakeHistory(downline, stakeIndex),
              packageManager.getStakeIncomeStatus(downline, stakeIndex),
            ]);
            const packageValue = stake.packageValue ?? stake[0];
            const incomeLimit = income.incomeLimit ?? income[0];
            const usedIncome = income.usedIncome ?? income[1];
            const remainingIncome = income.remainingIncome ?? income[2];
            const completed = income.completed ?? income[3];
            if (packageValue > 0n && !completed && usedIncome < incomeLimit && remainingIncome === incomeLimit - usedIncome) {
              totals[level] += packageValue;
            }
          }, 5);
        }, 4);
      }

      setLevelBusiness(totals.map((amount) => ethers.formatUnits(amount, 18)));
    } catch (error) {
      setLevelBusinessRefreshError(error?.shortMessage || error?.message || "V1 active level business calculate nahi ho saka.");
    } finally {
      setRefreshingLevelBusiness(false);
    }
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

  const refreshV1PendingLevelRoi = async () => {
    if (!ethers.isAddress(values.user)) {
      setPendingLevelRoiError("Pehle valid beneficiary wallet address enter karein.");
      return;
    }
    try {
      setRefreshingPendingLevelRoi(true);
      setPendingLevelRoiError("");
      const referral = new ethers.Contract(V1_MAINNET.referralNetwork, V1_REFERRAL_READER_ABI, createV1ReadProvider());
      const [openLevels, levelAmounts] = await Promise.all([
        Promise.all(Array.from({ length: 15 }, (_, level) => referral.isLevelOpen(values.user, level))),
        referral.getAllLevelRoiClaimableFor(values.user),
      ]);
      setOpenV1Levels(openLevels.map(Boolean));
      setPendingLevelRoi(Array.from(levelAmounts, (amount) => ethers.formatUnits(amount, 18)));
      setPendingLevelRoiRefreshed(true);
    } catch (error) {
      setPendingLevelRoiError(error?.shortMessage || error?.message || "V1 pending Level ROI read nahi ho saka.");
      setPendingLevelRoiRefreshed(false);
    } finally {
      setRefreshingPendingLevelRoi(false);
    }
  };

  const importPendingLevelRoiBatch = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask or Trust Wallet is not available.");
      const beneficiary = resolvedWalletAddress(values.user);
      if (!pendingLevelRoiRefreshed) throw new Error("Pehle Refresh V1 Pending Level ROI karein.");
      setImporting(true);
      setMessage("Checking V2 migration authority and preparing the verified Level ROI correction...");
      const { provider } = await authorisedVerifiedImporter();
      await verifyUser(provider, beneficiary);
      const expectedAmounts = pendingLevelRoi.map((amount) => ethers.parseUnits(amount || "0", 18));
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const manager = new ethers.Contract(PackageManagerAddress, MANAGER_LEGACY_RECOVERY_ABI, signer);
      setMessage("Confirm the Pending Level ROI batch correction transaction in your wallet.");
      const tx = await manager.setLegacyPendingLevelRoiBatch(beneficiary, expectedAmounts);
      await tx.wait();
      setMessage("Verified V1 Pending Level ROI saved successfully. Repeating this action later replaces only the legacy snapshot; it never duplicates V2 ROI.");
      window.dispatchEvent(new Event("btf:v2-data-changed"));
    } catch (error) {
      setMessage(error?.shortMessage || error?.reason || error?.message || "Pending Level ROI batch import failed.");
    } finally { setImporting(false); }
  };

  const checkpointContract = async () => {
    if (!window.ethereum) throw new Error("MetaMask or Trust Wallet is not available.");
    await window.ethereum.request({ method: "eth_requestAccounts" });
    await ensureBscMainnet();
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

  const importVerifiedRanks = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask or Trust Wallet is not available.");
      const beneficiary = resolvedWalletAddress(values.user);
      if (!verifiedRankImport) throw new Error("Verified V1 Power/Reward Importer address is not configured for this deployment.");
      setImporting(true);
      setMessage("Reading V1 Power/Reward rank, claimed installments and current pending income on-chain...");
      const { provider } = await authorisedVerifiedImporter();
      await verifyUser(provider, beneficiary);
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const importer = new ethers.Contract(V2VerifiedLegacyRankImporterAddress, VERIFIED_RANK_IMPORTER_ABI, signer);
      const tx = await importer.importVerifiedRanks(beneficiary);
      setMessage("Confirm the verified V1 Power & Reward import transaction in your wallet.");
      await tx.wait();
      setMessage("Verified V1 Power and Reward state imported successfully.");
      window.dispatchEvent(new Event("btf:v2-data-changed"));
    } catch (error) { setMessage(error?.shortMessage || error?.reason || error?.message || "Verified Power/Reward import failed.");
    } finally { setImporting(false); }
  };

  const powerRate = (level) => [0n, 25n, 50n, 100n, 250n, 500n, 1000n, 2500n, 5000n, 10000n][Number(level)] * 10n ** 18n;
  const rewardRate = (index) => (index === 1 ? 250n : index === 2 ? 500n : index === 3 ? 1250n : index === 4 ? 2500n : 5000n) * 10n ** 18n;
  const rewardInstallmentCount = (index) => index <= 5 ? 1n : index === 6 ? 2n : index === 7 ? 4n : index === 8 ? 8n : index === 9 ? 16n : index === 10 ? 32n : index === 11 ? 64n : 128n;
  const releasedCount = (startedAt, interval, maximum) => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (startedAt === 0n || now < startedAt) return 0n;
    const count = ((now - startedAt) / interval) + 1n;
    return count > maximum ? maximum : count;
  };

  const checkV1PowerAndReward = async () => {
    if (!ethers.isAddress(values.user)) {
      setV1RankCheckError("Pehle valid beneficiary wallet address enter karein.");
      return;
    }
    try {
      setCheckingV1Ranks(true);
      setV1RankCheckError("");
      setV1RankSnapshot(null);
      const provider = createV1ReadProvider();
      const manager = new ethers.Contract(V1_MAINNET.packageManager, V1_RANK_MANAGER_ABI, provider);
      const [powerModuleAddress, rewardModuleAddress, oneDay, powerFlush, rewardFlush] = await Promise.all([
        manager.powerIncomeModule(),
        manager.rewardIncomeModule(),
        manager.oneDay(),
        manager.totalOverflowByType(values.user, 3),
        manager.totalOverflowByType(values.user, 4),
      ]);
      const power = new ethers.Contract(powerModuleAddress, V1_POWER_READER_ABI, provider);
      const reward = new ethers.Contract(rewardModuleAddress, V1_REWARD_READER_ABI, provider);
      const [powerLevel, powerStartedAt, powerPaid] = await Promise.all([
        power.activePowerLevel(values.user),
        power.powerLevelStartedAt(values.user),
        power.powerClaimedCount(values.user),
      ]);
      const powerReleased = powerLevel === 0n ? 0n : releasedCount(powerStartedAt, 10n * oneDay, 20n);
      const powerPending = powerLevel === 0n || powerReleased <= powerPaid ? 0n : (powerReleased - powerPaid) * powerRate(powerLevel);
      const rewards = [];
      for (let index = 1; index <= 12; index += 1) {
        const achievedAt = await reward.rewardAchievedAt(values.user, index);
        if (achievedAt === 0n) break;
        const claimedAmount = await reward.rewardClaimedAmountByIndex(values.user, index);
        const rate = rewardRate(index);
        const paid = claimedAmount / rate;
        const released = releasedCount(achievedAt, 30n * oneDay, rewardInstallmentCount(index));
        const pending = released <= paid ? 0n : (released - paid) * rate;
        rewards.push({ index, claimedAmount, pending });
      }
      setV1RankSnapshot({ powerLevel, powerPending, powerPaid, powerFlush, rewardFlush, rewards });
    } catch (error) {
      setV1RankCheckError(error?.shortMessage || error?.message || "V1 Power/Reward data read nahi ho saka.");
    } finally {
      setCheckingV1Ranks(false);
    }
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

  const refreshNearLimitUsers = async () => {
    if (!verifiedPackageImport) {
      setNearLimitUsersError("Verified legacy importer address is not configured.");
      return;
    }
    try {
      setRefreshingNearLimitUsers(true);
      setNearLimitUsersError("");
      setNearLimitUsers([]);
      setNearLimitUsersScanned(0);

      const v1Provider = createV1ReadProvider();
      const v2Provider = new ethers.JsonRpcProvider(
        BSC_MAINNET.rpcUrls[1], BSC_MAINNET.chainId, { staticNetwork: true, batchMaxCount: 1, batchStallTime: 0 },
      );
      const v1Registry = new ethers.Contract(V1_MAINNET.referralNetwork, V1_STRUCTURE_READER_ABI, v1Provider);
      const v1Manager = new ethers.Contract(V1_MAINNET.packageManager, V1_PACKAGE_READER_ABI, v1Provider);
      const v2Registry = new ethers.Contract(ReferralNetworkAddress, V2_STRUCTURE_MIGRATION_ABI, v2Provider);
      const verifiedImporter = new ethers.Contract(V2VerifiedLegacyImporterAddress, VERIFIED_IMPORTER_ABI, v2Provider);
      const v2Ledger = new ethers.Contract(V2LedgerAddress, V2_LEDGER_MIGRATION_ABI, v2Provider);
      const nextUserId = Number(await v1Registry.nextUserId());
      const ids = Array.from({ length: Math.max(nextUserId - 1, 0) }, (_, index) => index + 1);
      const candidates = [];

      for (let offset = 0; offset < ids.length; offset += NEXT_USER_SCAN_BATCH_SIZE) {
        const batch = ids.slice(offset, offset + NEXT_USER_SCAN_BATCH_SIZE);
        const entries = await Promise.all(batch.map(async (id) => {
          const address = await v1Registry.idToAddress(id);
          if (address === ethers.ZeroAddress) return null;
          const [profile, packageLength] = await Promise.all([
            v1Registry.users(address),
            v1Manager.getStakeHistoryLength(address),
          ]);
          if (!Boolean(profile?.exists ?? profile?.[8]) || packageLength === 0n) return null;
          const statuses = await Promise.all(
            Array.from({ length: Number(packageLength) }, (_, index) => v1Manager.getStakeIncomeStatus(address, index)),
          );
          const incomeLimit = statuses.reduce((total, status) => total + BigInt(status.incomeLimit ?? status[0] ?? 0n), 0n);
          const usedIncome = statuses.reduce((total, status) => total + BigInt(status.usedIncome ?? status[1] ?? 0n), 0n);
          const remainingIncome = incomeLimit > usedIncome ? incomeLimit - usedIncome : 0n;
          if (remainingIncome >= NEAR_LIMIT_THRESHOLD) return null;
          return { id, address, incomeLimit, usedIncome, remainingIncome };
        }));
        candidates.push(...entries.filter(Boolean));
        setNearLimitUsersScanned(Math.min(offset + batch.length, ids.length));
      }

      const unresolved = [];
      for (let offset = 0; offset < candidates.length; offset += NEXT_USER_SCAN_BATCH_SIZE) {
        const batch = candidates.slice(offset, offset + NEXT_USER_SCAN_BATCH_SIZE);
        const entries = await Promise.all(batch.map(async (candidate) => {
          const [levelBusinessSeeded, levelRoiImported, legacyPackageImported, levelRoiCreditCount] = await Promise.all([
            v2Registry.legacyLevelSeeded(candidate.address),
            verifiedImporter.legacyLevelRoiImported(candidate.address),
            verifiedImporter.imported(candidate.address),
            v2Ledger.getUserIncomeHistoryLengthByType(candidate.address, 2),
          ]);
          // Earlier authorised Level-ROI imports credited the V2 ledger but
          // did not always set the current importer's status flag. A legacy
          // package holder with Level-ROI ledger credits has already had that
          // snapshot migrated and must not be offered again by this queue.
          const levelRoiCompleted = levelRoiImported
            || (legacyPackageImported && levelRoiCreditCount > 0n);
          // Once both one-time migrations are complete, this user must no
          // longer be offered by the operational queue.
          if (levelBusinessSeeded && levelRoiCompleted) return null;
          return {
            ...candidate,
            levelBusiness: levelBusinessSeeded ? "Completed" : "Pending",
            levelRoi: levelRoiCompleted ? "Completed" : "Pending",
          };
        }));
        unresolved.push(...entries.filter(Boolean));
      }

      setNearLimitUsers(unresolved
        .sort((left, right) => left.remainingIncome === right.remainingIncome
          ? left.id - right.id
          : left.remainingIncome < right.remainingIncome ? -1 : 1)
        .map((entry, index) => ({
          ...entry,
          sno: index + 1,
          wallet: entry.address,
          incomeLimitDisplay: formatUsdt(entry.incomeLimit),
          usedIncomeDisplay: formatUsdt(entry.usedIncome),
          remainingIncomeDisplay: formatUsdt(entry.remainingIncome),
        })));
    } catch (error) {
      setNearLimitUsers([]);
      setNearLimitUsersError(error?.shortMessage || error?.message || "Near-limit V1 users could not be scanned.");
    } finally {
      setRefreshingNearLimitUsers(false);
    }
  };

  if (!accessChecked) return <div className="page-container migration-page"><div className="migration-form-shell"><p className="migration-panel-note">Checking migration access...</p></div></div>;
  if (!canViewMigration) return <div className="page-container migration-page"><div className="migration-form-shell"><div className="migration-form-heading"><div className="migration-form-icon"><i className="bi bi-shield-lock" /></div><div><h1>Migration Access Restricted</h1><p>Only the V2 Registry owner, a wallet with <code>migrationOperator = true</code>, or an approved migrated-wallet viewer can view Migration Data.</p></div></div></div></div>;

  return <div className="page-container migration-page"><div className="migration-form-shell">
    <div className="migration-form-heading"><div className="migration-form-icon"><i className="bi bi-arrow-left-right" /></div><div><h1>Migration Data</h1><p>V1 package, Power and Reward values are verified on-chain before V2 import.</p></div></div>
    {SHOW_TREE_REGISTRATION_RUNNER && <div className="migration-level-panel">
      <div className="migration-section-title"><span>1</span> V1 Tree Registration Runner</div>
      <p className="migration-panel-note">Migration starts at V1 ID 1. First load and review the V1 ID, wallet and referrer. Only after your review, press the Migrate button to open MetaMask. After every confirmed transaction, the next V1 address is loaded automatically. An error stops the runner on that user; no later user is submitted.</p>
      <div className="migration-address-row"><div className="migration-field"><label>Start / Next V1 User ID</label><input value={nextV1Id} onChange={(event) => setNextV1Id(event.target.value.replace(/[^0-9]/g, ""))} placeholder="1" inputMode="numeric" autoComplete="off" /></div></div>
      <div className="migration-actions"><button className="migration-secondary-action" onClick={() => loadNextV1User()} disabled={loadingNextV1User || importing}>{loadingNextV1User ? "Loading V1 User..." : "Load Next V1 User"}</button>{nextV1User && <button className="migration-primary-button" onClick={migrateNextV1User} disabled={importing}>{importing ? "Migrating..." : `Migrate V1 ID ${nextV1User.id}`}<i className="bi bi-arrow-right" /></button>}</div>
      {nextV1User && <div className="migration-active-package-results"><p>Ready for V2 structure migration</p><div className="migration-active-package-item"><strong>V1 ID #{nextV1User.id}</strong><span>User: {nextV1User.user}</span><span>V1 Referrer: {nextV1User.referral}</span><span>Registered: {new Date(Number(nextV1User.registeredAt) * 1000).toLocaleString()}</span></div></div>}
    </div>}
    <div className="migration-section-title"><span>1</span> Beneficiary</div>
    <div className="migration-address-row"><div className="migration-field migration-field-wide"><label htmlFor="migration-user">User Wallet Address</label><input id="migration-user" value={values.user} onChange={(event) => setValue("user", event.target.value)} placeholder="0x..." autoComplete="off" /></div></div>
    <div className="migration-section-title"><span>2</span> Verified V1 Active Package</div>
    <div className="migration-package-layout">
      <div className="migration-package-check-column">
        <button className="migration-secondary-button" onClick={checkActiveV1Packages} disabled={checkingActivePackages || importing}>{checkingActivePackages ? "Checking..." : "Check Active Packages"}</button>
        {activePackageCheckError && <div className="migration-package-check-error">{activePackageCheckError}</div>}
        {activeV1Packages.length > 0 && <div className="migration-active-package-results"><p>Active V1 package indexes · V1 Direct Pending: {ethers.formatUnits(activeV1DirectIncome, 18)} USDT</p>{activeV1Packages.map((item) => <div className="migration-active-package-item" key={item.index}><strong>Index #{item.index}</strong><span>Package: {ethers.formatUnits(item.packageValue, 18)} USDT</span><span>Income Limit: {ethers.formatUnits(item.incomeLimit, 18)} USDT</span><span>Used Income: {ethers.formatUnits(item.usedIncome, 18)} USDT</span><span>Remaining: {ethers.formatUnits(item.remainingIncome, 18)} USDT</span><span>Direct Pending (to V2): {ethers.formatUnits(activeV1DirectIncome, 18)} USDT</span><span>Self ROI: {ethers.formatUnits(item.selfRoiGenerated, 18)} / {ethers.formatUnits(item.selfRoiMaximum, 18)} USDT</span><span>Self ROI Claimed: {ethers.formatUnits(item.selfRoiClaimed, 18)} USDT</span><span>Self ROI Claimable: {ethers.formatUnits(item.selfRoiClaimable, 18)} USDT</span></div>)}</div>}
        {!checkingActivePackages && !activePackageCheckError && activeV1Packages.length === 0 && <p className="migration-panel-note migration-package-empty">{hasCheckedActivePackages ? "No active V1 package found for this beneficiary." : "Check beneficiary's active V1 packages."}</p>}
      </div>
      <div className="migration-package-import-column">
        <Field label="Active V1 Package Index / Indexes" value={values.sourceIndex} onChange={(value) => setValue("sourceIndex", value)} placeholder="e.g. 2 or 6,7" />
        <label className="migration-special-import-toggle">
          <input type="checkbox" checked={includeV1IncomeAndV2SelfRoi} onChange={(event) => setIncludeV1IncomeAndV2SelfRoi(event.target.checked)} />
          <span><strong>V1 withdrawal disabled — migrate income and continue V2 Self ROI</strong><small>Use only when V1 withdrawal is permanently closed. It copies V1 pending Direct Income and pending Self ROI once, then starts future V2 Self ROI for these imported packages.</small></span>
        </label>
        {!includeV1IncomeAndV2SelfRoi && <p className="migration-import-mode-note">Normal import: package + used limit only. V1 income stays in V1.</p>}
        <div className="migration-actions"><button
          type="button"
          className="migration-primary-button"
          onClick={() => {
            // Show feedback synchronously, before MetaMask/RPC work begins.
            // This also prevents an enclosing form (present or added later)
            // from swallowing the click as a browser submit.
            setMessage("Preparing V1 package import for wallet confirmation...");
            void callImport();
          }}
          disabled={importing || !verifiedPackageImport}
        >{importing ? "Importing..." : "Import Verified V1 Package"}<i className="bi bi-arrow-right" /></button></div>
        {message && <div className="migration-message">{message}</div>}
      </div>
    </div>
    <div className="migration-level-panel">
      <div className="migration-section-title"><span>3</span> Active Level Business</div>
      <p className="migration-panel-note">Enter only active V1 package business for every level. This is a one-time seed and requires the package import first.</p>
      <div className="migration-level-refresh"><button className="migration-secondary-action" onClick={refreshV1LevelBusiness} disabled={refreshingLevelBusiness || importing}>{refreshingLevelBusiness ? "Refreshing V1 Business..." : "Refresh V1 Active Business"}</button>{levelBusinessRefreshError && <span>{levelBusinessRefreshError}</span>}</div>
      <div className="migration-level-grid">{levelBusiness.map((amount, index) => <Field key={index} label={`Level ${index + 1} Business`} suffix="USDT" value={amount} onChange={(value) => setLevelBusiness((current) => current.map((entry, position) => position === index ? value : entry))} placeholder="0" />)}</div>
      {legacyLevelSeeded === true && <p className="migration-panel-note">This user's V2 Level Business was already seeded. Do not submit this one-time call again.</p>}
      <div className="migration-actions"><button type="button" className="migration-primary-button" onClick={seedLevelBusiness} disabled={importing || legacyLevelSeeded === true}>{importing ? "Processing..." : legacyLevelSeeded === true ? "V2 Level Business Already Seeded" : "Call V2 Level Business Seed"}</button></div>
    </div>
    <div className="migration-level-panel">
      <div className="migration-section-title"><span>4</span> Pending Level ROI</div>
      <p className="migration-panel-note">Refresh V1 to read every currently open level and its pending ROI. The batch import reads V1 again on-chain and imports all open-level amounts in one transaction.</p>
      <div className="migration-level-refresh"><button className="migration-secondary-action" onClick={refreshV1PendingLevelRoi} disabled={refreshingPendingLevelRoi || importing}>{refreshingPendingLevelRoi ? "Refreshing V1 ROI..." : "Refresh V1 Pending Level ROI"}</button>{pendingLevelRoiError && <span>{pendingLevelRoiError}</span>}</div>
      {pendingLevelRoiRefreshed && <><div className="migration-pending-roi-summary"><span>Open Levels: {openV1Levels.filter(Boolean).length}</span><strong>Total Pending Level ROI: {ethers.formatUnits(pendingLevelRoi.reduce((total, amount) => total + ethers.parseUnits(amount || "0", 18), 0n), 18)} USDT</strong></div><div className="migration-level-grid">{pendingLevelRoi.map((amount, index) => openV1Levels[index] && <Field key={index} label={`Level ${index + 1} Pending ROI`} suffix="USDT" value={amount} onChange={(value) => setPendingLevelRoi((current) => current.map((entry, position) => position === index ? value : entry))} placeholder="0" />)}</div></>}
      <div className="migration-actions"><button className="migration-primary-button" onClick={importPendingLevelRoiBatch} disabled={importing || !verifiedPackageImport || !pendingLevelRoiRefreshed}>{importing ? "Processing..." : "Import All V1 Pending Level ROI"}</button></div>
    </div>
    <div className="migration-level-panel">
      <div className="migration-section-title"><span>6</span> Verified V1 Power & Reward Income</div>
      <p className="migration-panel-note">Beneficiary address above is passed to the importer. It reads the current V1 Power/Reward ranks, achieved time, claimed and flush state, then imports only the remaining pending income. No Power/Reward amount, rank or timestamp can be typed manually.</p>
      <div className="migration-level-refresh"><button className="migration-secondary-action" onClick={checkV1PowerAndReward} disabled={checkingV1Ranks || importing}>{checkingV1Ranks ? "Checking V1 Ranks..." : "Check V1 Power & Reward"}</button>{v1RankCheckError && <span>{v1RankCheckError}</span>}</div>
      {v1RankSnapshot && <div className="migration-rank-results"><div className="migration-rank-card"><span>V1 Power Rank</span><strong>{v1RankSnapshot.powerLevel === 0n ? "No Power Rank" : `P${v1RankSnapshot.powerLevel}`}</strong><small>Unclaimed: {ethers.formatUnits(v1RankSnapshot.powerPending, 18)} USDT</small><small>Claimed installments: {v1RankSnapshot.powerPaid.toString()} | Flush: {ethers.formatUnits(v1RankSnapshot.powerFlush, 18)} USDT</small></div><div className="migration-rank-card"><span>V1 Reward Rank</span><strong>{v1RankSnapshot.rewards.length ? `R${v1RankSnapshot.rewards.length}` : "No Reward Rank"}</strong><small>Unclaimed: {ethers.formatUnits(v1RankSnapshot.rewards.reduce((total, reward) => total + reward.pending, 0n), 18)} USDT</small><small>Flush: {ethers.formatUnits(v1RankSnapshot.rewardFlush, 18)} USDT</small>{v1RankSnapshot.rewards.map((reward) => <small key={reward.index}>R{reward.index}: {ethers.formatUnits(reward.pending, 18)} USDT pending</small>)}</div></div>}
      {!verifiedRankImport && <div className="migration-message">Set <code>VITE_BTF_V2_VERIFIED_LEGACY_RANK_IMPORTER_ADDRESS</code> before using verified Power/Reward migration.</div>}
      <div className="migration-actions"><button className="migration-primary-button" onClick={importVerifiedRanks} disabled={importing || !verifiedRankImport}>{importing ? "Processing..." : "Import Verified V1 Power & Reward"}<i className="bi bi-lightning-charge" /></button></div>
    </div>
    <div className="migration-level-panel">
      <div className="migration-section-title"><span>7</span> V1 Near-Limit Migration Queue</div>
      <p className="migration-panel-note">Shows registered V1 package holders with less than 10 USDT remaining income limit. A user leaves this queue only after both V2 Level Business and V1 Pending Level ROI migrations are completed.</p>
      <div className="migration-level-refresh">
        <button className="migration-secondary-action" onClick={refreshNearLimitUsers} disabled={refreshingNearLimitUsers || importing}>
          {refreshingNearLimitUsers ? `Scanning V1 Users (${nearLimitUsersScanned})...` : "Refresh Near-Limit Users"}
        </button>
        {nearLimitUsersError && <span>{nearLimitUsersError}</span>}
      </div>
      {!refreshingNearLimitUsers && nearLimitUsersScanned > 0 && !nearLimitUsersError && <p className="migration-panel-note">Scanned {nearLimitUsersScanned} V1 IDs. {nearLimitUsers.length} user(s) still require one or both migrations.</p>}
      <CustomTable
        columns={[
          { id: "sno", label: "S. No", sortable: true },
          { id: "id", label: "V1 User ID", sortable: true },
          { id: "wallet", label: "Wallet", sortable: true },
          { id: "incomeLimitDisplay", label: "Income Limit", sortable: true },
          { id: "usedIncomeDisplay", label: "Used Income", sortable: true },
          { id: "remainingIncomeDisplay", label: "Remaining Limit", sortable: true },
          { id: "levelBusiness", label: "Level Business", sortable: true },
          { id: "levelRoi", label: "Level ROI", sortable: true },
        ]}
        rows={nearLimitUsers}
        renderRow={(row) => <>
          <TableCell align="center">{row.sno}</TableCell><TableCell align="center">{row.id}</TableCell><TableCell align="center" className="team-address-cell">{row.wallet}</TableCell><TableCell align="center">{row.incomeLimitDisplay} USDT</TableCell><TableCell align="center">{row.usedIncomeDisplay} USDT</TableCell><TableCell align="center">{row.remainingIncomeDisplay} USDT</TableCell><TableCell align="center">{row.levelBusiness}</TableCell><TableCell align="center">{row.levelRoi}</TableCell>
        </>}
      />
    </div>
    {message && <div className="migration-message">{message}</div>}
  </div></div>;
}
