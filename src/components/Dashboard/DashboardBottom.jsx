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
} from "../../blockchain/address";
import { BSC_TESTNET } from "../../blockchain/bscTestnetConfig";
import { getReadWalletAddress } from "../../blockchain/readProvider";

const TOKEN_LABEL = "USDT";

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
    const loadDashboardData = async () => {
      if (!window.ethereum) {
        return;
      }

      try {
        const walletAddress = await getReadWalletAddress();

        if (!walletAddress || !ethers.isAddress(walletAddress)) {
          return;
        }

        // V2-only dashboard statistics. Earnings are V2 Ledger credits and
        // withdrawals are V2 Ledger withdrawal records.
        const v2Provider = new ethers.JsonRpcProvider(
          BSC_TESTNET.rpcUrls[1], BSC_TESTNET.chainId, { staticNetwork: true },
        );
        const v2Token = new ethers.Contract(TokenAddress, [
          "function decimals() view returns (uint8)",
          "function balanceOf(address owner) view returns (uint256)",
        ], v2Provider);
        const v2Manager = new ethers.Contract(PackageManagerAddress, V2PackageManagerABI, v2Provider);
        const v2Registry = new ethers.Contract(ReferralNetworkAddress, V2ReferralRegistryABI, v2Provider);
        const v2Ledger = new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, v2Provider);
        const [totalInvested, incomeLengthRaw, withdrawLengthRaw, v2TokenDecimals, v2TokenBalanceRaw, v2UserData] = await Promise.all([
          v2Manager.totalUsdtSpent(walletAddress),
          v2Ledger.getUserIncomeHistoryLength(walletAddress),
          v2Ledger.getUserWithdrawHistoryLength(walletAddress),
          v2Token.decimals(),
          v2Token.balanceOf(walletAddress),
          v2Registry.users(walletAddress),
        ]);
        const incomeRecords = await Promise.all(
          Array.from({ length: Number(incomeLengthRaw) }, (_, index) => v2Ledger.getUserIncomeHistoryAt(walletAddress, index))
        );
        const withdrawRecords = await Promise.all(
          Array.from({ length: Number(withdrawLengthRaw) }, (_, index) => v2Ledger.getUserWithdrawHistoryAt(walletAddress, index))
        );
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
        const totalWithdrawn = withdrawRecords.reduce((total, record) => total + BigInt(record.amount ?? record[0]), 0n);
        const levelOpen = await Promise.all(
          Array.from({ length: 15 }, (_, index) => v2Registry.isLevelOpen(walletAddress, index).catch(() => false))
        );
        const v2OpenCount = levelOpen.filter(Boolean).length;
        const v2IsRegistered = Boolean(v2UserData.exists ?? v2UserData[8]);
        setStats({ totalEarned: formatUsd(totalEarned), totalInvested: formatUsd(totalInvested), totalWithdrawn: formatUsd(totalWithdrawn) });
        setTokenInfo({ symbol: TOKEN_LABEL, balance: formatToken(v2TokenBalanceRaw, Number(v2TokenDecimals) || 18) });
        setWithdrawnByType({
          direct: formatToken(totalsByType.direct),
          roi: formatToken(totalsByType.roi),
          power: formatToken(totalsByType.power),
          reward: formatToken(totalsByType.reward),
        });
        setLevelOpenCount(String(v2OpenCount));
        if (v2IsRegistered) {
          const origin = window.location.origin;
          const basePath = import.meta.env.BASE_URL || "/";
          setReferralLink(`${origin}${basePath}?ref=${walletAddress.toLowerCase()}`);
        } else {
          setReferralLink("");
        }
        return;

        // Public data must be read from BSC directly. Some injected wallet
        // providers reject read calls and made the whole dashboard blank.
        const provider = new ethers.JsonRpcProvider(
          BSC_MAINNET.rpcUrls[1],
          BSC_MAINNET.chainId,
          { staticNetwork: true },
        );
        const tokenContract = new ethers.Contract(
          TokenAddress,
          [
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)",
            "function balanceOf(address owner) view returns (uint256)",
          ],
          provider,
        );
        const packageManager = new ethers.Contract(
          PackageManagerAddress,
          PackageManagerABI,
          provider,
        );
        const referralNetwork = new ethers.Contract(
          ReferralNetworkAddress,
          ReferralNetworkABI,
          provider,
        );

        const [
          totalDirectIncomeToken,
          totalSelfRoiIncomeClaimed,
          totalLevelRoiClaimed,
          totalPowerIncomeClaimed,
          totalRewardIncomeClaimed,
          totalUsdtSpent,
          totalIncomeWithdrawnToken,
        ] = await Promise.all([
          packageManager.totalDirectIncomeToken(walletAddress),
          packageManager.totalSelfRoiIncomeClaimed(walletAddress),
          packageManager.totalLevelRoiClaimed(walletAddress),
          packageManager.totalPowerIncomeClaimed(walletAddress),
          packageManager.totalRewardIncomeClaimed(walletAddress),
          packageManager.totalUsdtSpent(walletAddress),
          packageManager.totalIncomeWithdrawnToken(walletAddress),
        ]);

        const totalEarnedRaw =
          (totalDirectIncomeToken ?? 0n) +
          (totalSelfRoiIncomeClaimed ?? 0n) +
          (totalLevelRoiClaimed ?? 0n) +
          (totalPowerIncomeClaimed ?? 0n) +
          (totalRewardIncomeClaimed ?? 0n);

        const [, tokenDecimals, tokenBalanceRaw, userData] = await Promise.all([
          tokenContract.symbol(),
          tokenContract.decimals(),
          tokenContract.balanceOf(walletAddress),
          referralNetwork.users(walletAddress),
        ]);

        const isRegistered =
          Boolean(userData?.exists ?? userData?.[8]) ||
          Number(userData?.id ?? userData?.[0] ?? 0) > 0;

        // Do not wait for every old withdrawal record before showing the
        // principal dashboard values.
        setStats({
          totalEarned: formatUsd(totalEarnedRaw),
          totalInvested: formatUsd(totalUsdtSpent),
          totalWithdrawn: formatUsd(totalIncomeWithdrawnToken),
        });
        setTokenInfo({
          symbol: TOKEN_LABEL,
          balance: Number(
            ethers.formatUnits(tokenBalanceRaw ?? 0n, Number(tokenDecimals) || 18),
          ).toLocaleString(undefined, {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
          }),
        });
        if (isRegistered) {
          const origin = window.location.origin;
          const basePath = import.meta.env.BASE_URL || "/";
          setReferralLink(`${origin}${basePath}?ref=${walletAddress.toLowerCase()}`);
        } else {
          setReferralLink("");
        }

        try {
          const withdrawRecordsLengthRaw =
            await referralNetwork.getUserIncomeWithdrawRecordsLength(walletAddress);
          const withdrawRecordsLength = Number(withdrawRecordsLengthRaw ?? 0n);
          const totalsByType = { direct: 0n, roi: 0n, power: 0n, reward: 0n };

          const records = await Promise.all(
            Array.from({ length: withdrawRecordsLength }, (_, index) =>
              referralNetwork.getUserIncomeWithdrawRecordAt(walletAddress, index),
            ),
          );
          for (const record of records) {
            const incomeType = Number(record?.incomeType ?? record?.[1] ?? 0);
            const amount = BigInt(record?.amount ?? record?.[2] ?? 0n);
            if (incomeType === 0) totalsByType.direct += amount;
            else if (incomeType === 1 || incomeType === 2) totalsByType.roi += amount;
            else if (incomeType === 3) totalsByType.power += amount;
            else if (incomeType === 4) totalsByType.reward += amount;
          }

          setWithdrawnByType({
            direct: formatToken(totalsByType.direct, Number(tokenDecimals) || 18),
            roi: formatToken(totalsByType.roi, Number(tokenDecimals) || 18),
            power: formatToken(totalsByType.power, Number(tokenDecimals) || 18),
            reward: formatToken(totalsByType.reward, Number(tokenDecimals) || 18),
          });
        } catch {
          setWithdrawnByType({ direct: "0.0000", roi: "0.0000", power: "0.0000", reward: "0.0000" });
        }

        let openCount = 0;
        try {
          // As requested: loop only 0..14 and count true values.
          // Per-level try/catch so one revert does not zero-out all results.
          for (let idx = 0; idx < 15; idx += 1) {
            try {
              const isOpen = await referralNetwork.isLevelOpen(walletAddress, idx);
              if (isOpen) {
                openCount += 1;
              }
            } catch {
              // Ignore per-level failures and continue checking other levels.
            }
          }

          if (openCount === 0) {
            const latestBlock = await provider.getBlock("latest");
            const atTimestamp = Number(
              latestBlock?.timestamp ?? Math.floor(Date.now() / 1000),
            );
            for (let idx = 0; idx < 15; idx += 1) {
              try {
                const isOpenAt = await referralNetwork.isLevelOpenAt(
                  walletAddress,
                  idx,
                  atTimestamp,
                );
                if (isOpenAt) {
                  openCount += 1;
                }
              } catch {
                // Ignore per-level failures and continue.
              }
            }
          }
        } catch {
          openCount = 0;
        }

        setLevelOpenCount(String(openCount));
      } catch {
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
      }
    };

    const handleAccountsChanged = () => loadDashboardData();
    loadDashboardData();
    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
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
