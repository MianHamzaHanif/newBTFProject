import React, { useEffect, useState } from "react";
import img1 from "/icon/icon-7.png";
import img2 from "/icon/icon-8.png";
import img3 from "/icon/icon-9.png";
import Footer from "./Footer/Footer";
import { ethers } from "ethers";
import PackageManagerABI from "../../blockchain/packageMangerABI.json";
import ReferralNetworkABI from "../../blockchain/referralNetworkABI.json";
import V2PackageManagerABI from "../../blockchain/v2PackageManagerABI";
import V2ReferralRegistryABI from "../../blockchain/v2ReferralRegistryABI";
import V2IncomeLedgerABI from "../../blockchain/v2IncomeLedgerABI";
import {
  PackageManagerAddress,
  ReferralNetworkAddress,
  TokenAddress,
  V2LedgerAddress,
  V2VerifiedLegacyImporterAddress,
} from "../../blockchain/address";
import { createBscReadProvider, getReadWalletAddress } from "../../blockchain/readProvider";
import { V1_MAINNET } from "../../blockchain/v1MainnetConfig";

const TOKEN_LABEL = "USDT";
const LEGACY_IMPORT_EVENT = new ethers.Interface([
  "event LegacyPackageSnapshotImported(address indexed user,uint256 indexed sourceIndex,uint256 amount,uint256 usedIncome)",
]);

// Returns the exact V1 package indexes imported to V2. The event is emitted
// by the verified importer and avoids counting a migrated package twice in
// V1 + V2 dashboard investment totals.
const readImportedV1Indexes = async (provider, user) => {
  if (!ethers.isAddress(V2VerifiedLegacyImporterAddress)) return null;
  try {
    const event = LEGACY_IMPORT_EVENT.getEvent("LegacyPackageSnapshotImported");
    const logs = await provider.getLogs({
      address: V2VerifiedLegacyImporterAddress,
      topics: [event.topicHash, ethers.zeroPadValue(user, 32)],
      fromBlock: 0,
      toBlock: "latest",
    });
    return new Set(logs.map((log) => Number(LEGACY_IMPORT_EVENT.parseLog(log).args.sourceIndex)));
  } catch {
    return null;
  }
};

const DashboardBottom = () => {
  const [stats, setStats] = useState({
    totalEarned: "0.00 USD",
    totalInvested: "0.00 USD",
    totalWithdrawn: "0.00 USD",
  });
  const [referralLink, setReferralLink] = useState("");
  const [tokenInfo, setTokenInfo] = useState({
    symbol: TOKEN_LABEL,
    balance: "0.00",
  });
  const [copyStatus, setCopyStatus] = useState("");
  const [withdrawnByType, setWithdrawnByType] = useState({
    direct: "0.0000",
    roi: "0.0000",
    power: "0.0000",
    reward: "0.0000",
  });
  const [levelOpenCount, setLevelOpenCount] = useState("0");
  const [dataStatus, setDataStatus] = useState("");
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);

  const AvailableBalance = [
    {
      id: 1,
      iconClass: "bi bi-wallet2",
      currencyName: `${TOKEN_LABEL} Balance`,
      amount: tokenInfo.balance,
      currencySubtitle: TOKEN_LABEL,
    },

    {
      id: 2,
      iconClass: "bi bi-person-check-fill",
      currencyName: "Direct Income Withdrawn",
      amount: withdrawnByType.direct,
      currencySubtitle: TOKEN_LABEL,
    },

    {
      id: 3,
      iconClass: "bi bi-graph-up-arrow",
      currencyName: "ROI Income Withdrawn",
      amount: withdrawnByType.roi,
      currencySubtitle: TOKEN_LABEL,
    },

    {
      id: 4,
      iconClass: "bi bi-lightning-charge-fill",
      currencyName: "Power Income",
      amount: withdrawnByType.power,
      currencySubtitle: TOKEN_LABEL,
    },

    {
      id: 5,
      iconClass: "bi bi-gift-fill",
      currencyName: "Reward Income Withdrawn",
      amount: withdrawnByType.reward,
      currencySubtitle: TOKEN_LABEL,
    },
    {
      id: 6,
      iconClass: "bi bi-unlock-fill",
      currencyName: "Level Open",
      amount: levelOpenCount,
      currencySubtitle: "Levels",
    },
  ];

  const formatUsd = (value) => {
    try {
      const amount = Number(ethers.formatEther(value ?? 0n));
      return `${amount.toLocaleString(undefined, {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      })} USD`;
    } catch {
      return "0.0000 USD";
    }
  };

  const formatToken = (value, decimals = 18) => {
    try {
      return Number(ethers.formatUnits(value ?? 0n, decimals)).toLocaleString(
        undefined,
        {
          minimumFractionDigits: 4,
          maximumFractionDigits: 4,
        },
      );
    } catch {
      return "0.0000";
    }
  };

  useEffect(() => {
    const loadDashboardData = async (networkRetry = 0) => {
      if (!window.ethereum) {
        setDataStatus("Connect your BSC wallet to load V1 + V2 dashboard data.");
        return;
      }

      try {
        setIsDashboardLoading(true);
        const walletAddress = await getReadWalletAddress();

        if (!walletAddress || !ethers.isAddress(walletAddress)) {
          setDataStatus("Wallet account is not connected. Reconnect the registered wallet to load data.");
          return;
        }
        setDataStatus("Loading V1 + V2 data...");

        // Start V1 and V2 reads together. V1 totals are aggregate contract
        // fields, so they are fast even for accounts with a long history.
        const v1Provider = new ethers.JsonRpcProvider(
          V1_MAINNET.rpcUrl, V1_MAINNET.chainId, { staticNetwork: true },
        );
        const v1Manager = new ethers.Contract(V1_MAINNET.packageManager, PackageManagerABI, v1Provider);
        const v1Registry = new ethers.Contract(V1_MAINNET.referralNetwork, ReferralNetworkABI, v1Provider);
        const v1SummaryPromise = Promise.all([
          v1Manager.totalDirectIncomeToken(walletAddress),
          v1Manager.totalSelfRoiIncomeClaimed(walletAddress),
          v1Manager.totalLevelRoiClaimed(walletAddress),
          v1Manager.totalPowerIncomeClaimed(walletAddress),
          v1Manager.totalRewardIncomeClaimed(walletAddress),
          v1Manager.totalUsdtSpent(walletAddress),
          v1Manager.totalIncomeWithdrawnToken(walletAddress),
          Promise.all(Array.from(
            { length: 15 },
            (_, index) => v1Registry.isLevelOpen(walletAddress, index).catch(() => false),
          )),
          v1Registry.users(walletAddress),
        ]).catch(() => [0n, 0n, 0n, 0n, 0n, 0n, 0n, Array(15).fill(false), null]);
        const v1PackageRecordsPromise = (async () => {
          const length = Number(await v1Manager.getStakeHistoryLength(walletAddress));
          return Promise.all(Array.from({ length }, async (_, index) => {
            const stake = await v1Manager.userStakeHistory(walletAddress, index);
            return {
              index,
              amount: BigInt(stake?.packageValue ?? stake?.[0] ?? 0n),
              timestamp: BigInt(stake?.timestamp ?? stake?.[7] ?? 0n),
            };
          }));
        })().catch(() => null);

        const v2Provider = createBscReadProvider();
        const v2Token = new ethers.Contract(TokenAddress, [
          "function decimals() view returns (uint8)",
          "function balanceOf(address owner) view returns (uint256)",
        ], v2Provider);
        const v2Manager = new ethers.Contract(PackageManagerAddress, V2PackageManagerABI, v2Provider);
        const v2Registry = new ethers.Contract(ReferralNetworkAddress, V2ReferralRegistryABI, v2Provider);
        const v2Ledger = new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, v2Provider);
        const [totalInvested, incomeLengthRaw, withdrawLengthRaw, packageHistoryLengthRaw, v2TokenDecimals, v2TokenBalanceRaw, v2UserData] = await Promise.all([
          v2Manager.totalUsdtSpent(walletAddress),
          v2Ledger.getUserIncomeHistoryLength(walletAddress),
          v2Ledger.getUserWithdrawHistoryLength(walletAddress),
          v2Manager.getPackageHistoryLength(walletAddress),
          v2Token.decimals(),
          v2Token.balanceOf(walletAddress),
          v2Registry.users(walletAddress),
        ]);
        // These three read groups are independent. Start all of them before
        // awaiting so a large income history does not delay level status.
        const incomeRecordsPromise = Promise.all(
          Array.from({ length: Number(incomeLengthRaw) }, (_, index) => v2Ledger.getUserIncomeHistoryAt(walletAddress, index))
        );
        const withdrawRecordsPromise = Promise.all(
          Array.from({ length: Number(withdrawLengthRaw) }, (_, index) => v2Ledger.getUserWithdrawHistoryAt(walletAddress, index))
        );
        const levelOpenPromise = Promise.all(
          Array.from({ length: 15 }, (_, index) => v2Registry.isLevelOpen(walletAddress, index).catch(() => false))
        );
        const v2PackageRecordsPromise = Promise.all(
          Array.from({ length: Number(packageHistoryLengthRaw) }, async (_, index) => {
            const record = await v2Manager.getPackageHistoryAt(walletAddress, index);
            return {
              amount: BigInt(record.amount ?? record[0] ?? 0n),
              timestamp: BigInt(record.purchasedAt ?? record[1] ?? 0n),
            };
          }),
        );
        const [incomeRecords, withdrawRecords, levelOpen, v1Summary, v1PackageRecords, v2PackageRecords, importedV1Indexes] = await Promise.all([
          incomeRecordsPromise,
          withdrawRecordsPromise,
          levelOpenPromise,
          v1SummaryPromise,
          v1PackageRecordsPromise,
          v2PackageRecordsPromise,
          readImportedV1Indexes(v2Provider, walletAddress),
        ]);
        const [
          v1DirectIncome,
          v1SelfRoiIncome,
          v1LevelRoiIncome,
          v1PowerIncome,
          v1RewardIncome,
          v1Invested,
          v1Withdrawn,
          v1LevelOpen,
          v1UserData,
        ] = v1Summary;
        const totalsByType = { direct: 0n, roi: 0n, power: 0n, reward: 0n };
        let totalEarned = 0n;
        for (const record of incomeRecords) {
          const incomeType = Number(record.incomeType ?? record[0]);
          const amount = BigInt(record.amount ?? record[2]);
          totalEarned += amount;
          if (incomeType === 0) totalsByType.direct += amount;
          else if (incomeType === 1 || incomeType === 2) totalsByType.roi += amount;
          else if (incomeType === 3) totalsByType.power += amount;
          else if (incomeType === 4) totalsByType.reward += amount;
        }
        const v2Withdrawn = withdrawRecords.reduce((total, record) => total + BigInt(record.amount ?? record[0]), 0n);
        const v1Earned = BigInt(v1DirectIncome)
          + BigInt(v1SelfRoiIncome)
          + BigInt(v1LevelRoiIncome)
          + BigInt(v1PowerIncome)
          + BigInt(v1RewardIncome);
        // V2 totalUsdtSpent already includes a package imported from V1. Add
        // only V1 packages that have no V2 import event, so Total Invested
        // follows the same no-duplicate rule as Activation Package.
        let visibleV1Investment = BigInt(v1Invested);
        if (Array.isArray(v1PackageRecords)) {
          if (importedV1Indexes) {
            visibleV1Investment = v1PackageRecords.reduce(
              (total, record) => importedV1Indexes.has(record.index) ? total : total + record.amount,
              0n,
            );
          } else {
            // Event reads can be unavailable on a restrictive RPC. Preserve
            // the same conservative amount/time fallback used by Activation.
            const v2Matches = new Map();
            for (const record of v2PackageRecords) {
              const key = `${record.amount}|${record.timestamp}`;
              v2Matches.set(key, (v2Matches.get(key) || 0) + 1);
            }
            visibleV1Investment = v1PackageRecords.reduce((total, record) => {
              const key = `${record.amount}|${record.timestamp}`;
              const count = v2Matches.get(key) || 0;
              if (count) {
                v2Matches.set(key, count - 1);
                return total;
              }
              return total + record.amount;
            }, 0n);
          }
        }
        // Each card represents the same income class across both deployed
        // contracts. V1's Self + Level ROI map to the V2 ROI card.
        const combinedByType = {
          direct: totalsByType.direct + BigInt(v1DirectIncome),
          roi: totalsByType.roi + BigInt(v1SelfRoiIncome) + BigInt(v1LevelRoiIncome),
          power: totalsByType.power + BigInt(v1PowerIncome),
          reward: totalsByType.reward + BigInt(v1RewardIncome),
        };
        // A level is logically open once if it is open in either version;
        // do not double-count the same 15 referral levels.
        const combinedOpenCount = levelOpen.reduce(
          (total, isV2Open, index) => total + (isV2Open || v1LevelOpen[index] ? 1 : 0),
          0,
        );
        const v2IsRegistered = Boolean(v2UserData.exists ?? v2UserData[8]);
        const v1IsRegistered = Boolean(v1UserData?.exists ?? v1UserData?.[8])
          || Number(v1UserData?.id ?? v1UserData?.[0] ?? 0) > 0;
        setStats({
          totalEarned: formatUsd(totalEarned + v1Earned),
          totalInvested: formatUsd(BigInt(totalInvested) + visibleV1Investment),
          totalWithdrawn: formatUsd(v2Withdrawn + BigInt(v1Withdrawn)),
        });
        setTokenInfo({ symbol: TOKEN_LABEL, balance: formatToken(v2TokenBalanceRaw, Number(v2TokenDecimals) || 18) });
        setWithdrawnByType({
          direct: formatToken(combinedByType.direct),
          roi: formatToken(combinedByType.roi),
          power: formatToken(combinedByType.power),
          reward: formatToken(combinedByType.reward),
        });
        setLevelOpenCount(String(combinedOpenCount));
        if (v2IsRegistered || v1IsRegistered) {
          const origin = window.location.origin;
          const basePath = import.meta.env.BASE_URL || "/";
          setReferralLink(`${origin}${basePath}?ref=${walletAddress.toLowerCase()}`);
        } else {
          setReferralLink("");
        }
        setDataStatus(v2IsRegistered || v1IsRegistered
          ? `Loaded V1 + V2 dashboard data for ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}.`
          : "This connected wallet is not registered in either V1 or V2.");
      } catch (error) {
        const message = error?.shortMessage || error?.message || "";
        // Mobile wallets may emit this while they are switching from the
        // wallet's previous chain to BSC. It is not a BSC contract failure;
        // discard that stale request and read again once the switch settles.
        if (/network changed|network mismatch/i.test(message) && networkRetry < 2) {
          setDataStatus("BSC Mainnet selected. Reloading V1 + V2 dashboard data...");
          window.setTimeout(() => {
            void loadDashboardData(networkRetry + 1);
          }, 900);
          return;
        }
        setStats({
          totalEarned: "0.00 USD",
          totalInvested: "0.00 USD",
          totalWithdrawn: "0.00 USD",
        });
        setReferralLink("");
        setTokenInfo({
          symbol: TOKEN_LABEL,
          balance: "0.00",
        });
        setWithdrawnByType({
          direct: "0.0000",
          roi: "0.0000",
          power: "0.0000",
          reward: "0.0000",
        });
        setLevelOpenCount("0");
        setDataStatus(message || "Could not read dashboard data from BSC. Refresh and try again.");
      } finally {
        setIsDashboardLoading(false);
      }
    };

    const handleAccountsChanged = () => loadDashboardData();
    const handleV2DataChanged = () => loadDashboardData();
    loadDashboardData();
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.addEventListener("btf:v2-data-changed", handleV2DataChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.removeEventListener("btf:v2-data-changed", handleV2DataChanged);
    };
  }, []);

  const handleCopyReferralLink = async () => {
    if (!referralLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopyStatus("Referral copied");
      setTimeout(() => {
        setCopyStatus("");
      }, 1800);
    } catch {
      setCopyStatus("Copy failed");
      setTimeout(() => {
        setCopyStatus("");
      }, 1800);
    }
  };

  return (
    <div className="dashboardWrapper">
      <div className="header">
        <h3>
          Your <span>Stastistics</span>
        </h3>
        {/* <div className="icon-wrapper">
          <div className="img">
            <img src={icon1} alt="" />
          </div>

          <div className="img">
            <img src={icon2} alt="" />
          </div>

          <div className="img">
            <img src={icon3} alt="" />
          </div>

          <div className="img">
            <img src={icon4} alt="" />
          </div>

          <div className="img">
            <img src={icon5} alt="" />
          </div>

          <div className="img">
            <img src={icon6} alt="" />
          </div>
        </div> */}
      </div>
      <div className="statistics-wrapper">
        <div className="statictics-card">
          <div className="img">
            <img src={img1} alt="" />
          </div>
          <p className="subtitle">Total Earned</p>
          <p className="price">{stats.totalEarned}</p>
        </div>
        <div className="statictics-card">
          <div className="img">
            <img src={img2} alt="" />
          </div>
          <p className="subtitle">Total Invested</p>
          <p className="price">{stats.totalInvested}</p>
        </div>
        <div className="statictics-card">
          <div className="img">
            <img src={img3} alt="" />
          </div>
          <p className="subtitle">Withdrawan </p>
          <p className="price">{stats.totalWithdrawn}</p>
        </div>
      </div>

      <div className="dashboard-bottom-wrapper">
        {isDashboardLoading && <p className="team-loading" style={{ gridColumn: "1 / -1" }}>Loading V1 + V2 dashboard data...</p>}
        {dataStatus && <p className="team-loading" style={{ gridColumn: "1 / -1" }}>{dataStatus}</p>}
        <div className="affiliate-section">
          {/* <div className="affiliate-header">
            <h2>
              Affiliate <span>Program</span>
            </h2>
            <a href="#" className="link">
              Your Partners
            </a>
          </div> */}

          <div className="affiliate-card">
            <p className="affiliate-subtitle">
              Our company is officially registered in the registry.
            </p>
            <div className="levels">
              <div className="level-box">
                <div className="level-card">
                  <div className="inner">
                    <p>1-5</p>
                    <h2>10%</h2>
                  </div>
                </div>
              </div>
              <div className="level-box">
                <div className="inner">
                  <p>6-10</p>
                  <h2>5%</h2>
                </div>
              </div>
              <div className="level-box">
                <div className="inner">
                  <p>11-15</p>
                  <h2>5%</h2>
                </div>
              </div>
            </div>
            <p className="affiliate-level-note">
              Referral level commission slabs: Level 1-5 = 10% each referral
              level, Level 6-10 = 5% each level, Level 11-15 = 5% each level.
            </p>

            <div className="ref-link">
              <p>Your Referral Link</p>
              <div className="input-box">
                <input
                  type="text"
                  value={referralLink || "Connect registered wallet to get link"}
                  readOnly
                />
                <button onClick={handleCopyReferralLink} disabled={!referralLink}>
                  <i className="bi bi-copy"></i>
                </button>
              </div>
              {copyStatus && <p className="copy-status">{copyStatus}</p>}
            </div>

            {/* <div className="bottom-row">
              <p>
                Invited by: <span>Userlogin</span>
              </p>
              <button className="banner-btn">Show banners</button>
            </div> */}
          </div>
        </div>

        <div className="balance-section">
          {/* <div className="balance-header">
            <h2>
              Available <span>Balance</span>
            </h2>
            <a href="#" className="link">
              Your Partners
            </a>
          </div> */}

          <div className="balance-box-wrapper">
            {AvailableBalance.map((item, idx) => (
              <div className="balance-box" key={item.id ?? idx}>
                <div className="image-name-wrapper">
                  <div className="crpto-img">
                    <i className={item.iconClass}></i>
                  </div>
                  <p className="currency-name">{item.currencyName}</p>
                </div>

                <div className="balance">
                  <p className="amount">{item.amount}</p>
                  <p className="currency">{item.currencySubtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default DashboardBottom;
