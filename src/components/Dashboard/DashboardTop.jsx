import React, { useCallback, useEffect, useState } from "react";
import "./style.css";
import circleimg from "/dashboardimg/dashboard-img.png";
import { useOutletContext } from "react-router-dom";
import { ethers } from "ethers";
import PackageManagerABI from "../../blockchain/packageMangerABI.json";
import PackageManagerLensABI from "../../blockchain/packageManagerLensABI.json";
import ReferralNetworkABI from "../../blockchain/referralNetworkABI.json";
import V2PackageManagerABI from "../../blockchain/v2PackageManagerABI";
import V2ReferralRegistryABI from "../../blockchain/v2ReferralRegistryABI";
import V2IncomeLedgerABI from "../../blockchain/v2IncomeLedgerABI";
import {
  PackageManagerAddress,
  PackageManagerLensAddress,
  ReferralNetworkAddress,
  TokenAddress,
  V2LedgerAddress,
} from "../../blockchain/address";
import { BSC_TESTNET, WALLET_ADD_CHAIN_PARAMS } from "../../blockchain/bscTestnetConfig";
import { createBscReadProvider, getReadWalletAddress } from "../../blockchain/readProvider";

const DashboardTop = () => {
  const { SetSidebarOpen } = useOutletContext();
  const [selectedPackage, setSelectedPackage] = useState("25");
  const [packageOptions] = useState([
    "25",
    "100",
    "500",
    "1000",
  ]);
  const [isBuying, setIsBuying] = useState(false);
  const [buyStatus, setBuyStatus] = useState("");
  const [utcNow, setUtcNow] = useState("");
  const [planActivity, setPlanActivity] = useState({
    progressText: "0% / 0%",
    activeStakeLabel: "No active package",
    selfRoiReadyLabel: "Current Self ROI Ready: 0.0000 USDT",
    remainingSeconds: 0,
  });
  const [dayCycle, setDayCycle] = useState({
    oneDaySeconds: 86400,
    remainingSeconds: 0,
  });
  const [packageWarnings, setPackageWarnings] = useState([]);
  const [purchaseSafety, setPurchaseSafety] = useState({
    blocked: false,
    effectiveRemaining: 0n,
  });

  const formatNumber2 = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return "0.0000";
    }
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  };

  const formatEther2 = (value) => {
    try {
      return formatNumber2(ethers.formatEther(value ?? 0n));
    } catch {
      return "0.0000";
    }
  };

  const toPercent2 = (numerator, denominator) => {
    try {
      const num = BigInt(numerator ?? 0n);
      const den = BigInt(denominator ?? 0n);
      if (den <= 0n) {
        return "0.00";
      }
      const scaled = (num * 10000n) / den;
      return (Number(scaled) / 100).toFixed(2);
    } catch {
      return "0.00";
    }
  };

  const incomeLimitForPackage = (amount) => {
    const packageAmount = BigInt(amount ?? 0n);
    if (packageAmount === ethers.parseEther("25")) return ethers.parseEther("75");
    if (packageAmount === ethers.parseEther("100")) return ethers.parseEther("500");
    if (packageAmount === ethers.parseEther("500")) return ethers.parseEther("3500");
    if (packageAmount === ethers.parseEther("1000")) return ethers.parseEther("10000");
    return 0n;
  };

  const formatCountdown = (totalSeconds) => {
    const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  };

  const loadPlanActivity = useCallback(async () => {
    if (!window.ethereum) {
      setPlanActivity({
        progressText: "0% / 0%",
        activeStakeLabel: "No active package",
        selfRoiReadyLabel: "Current Self ROI Ready: 0.0000 USDT",
        remainingSeconds: 0,
      });
      return;
    }

    try {
      // V2-only dashboard plan data.
      const wallet = await getReadWalletAddress();
      if (!wallet || !ethers.isAddress(wallet)) throw new Error("WALLET");
      const v2Provider = createBscReadProvider();
      const v2Manager = new ethers.Contract(PackageManagerAddress, V2PackageManagerABI, v2Provider);
      const v2Ledger = new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, v2Provider);
      const [currentPackage, totalIncomeLimit, packageHistoryLength, incomeHistoryLength, directReady, selfRoiReady, levelRoiReady, powerReady, rewardReady, roiDayRaw, roiStartRaw] = await Promise.all([
        v2Manager.currentPackage(wallet),
        v2Manager.totalIncomeLimit(wallet),
        v2Manager.getPackageHistoryLength(wallet),
        v2Ledger.getUserIncomeHistoryLength(wallet),
        v2Manager.getIncomeReady(wallet, 0),
        v2Manager.getIncomeReady(wallet, 1),
        v2Manager.getIncomeReady(wallet, 2),
        v2Manager.getIncomeReady(wallet, 3),
        v2Manager.getIncomeReady(wallet, 4),
        v2Manager.ROI_DAY(),
        v2Manager.roiStartTime(),
      ]);
      if (BigInt(currentPackage) === 0n || BigInt(totalIncomeLimit) === 0n) {
        setPlanActivity({
          progressText: "0% / 0%",
          activeStakeLabel: "No active package",
          selfRoiReadyLabel: `Current Self ROI Ready: ${formatEther2(selfRoiReady)} USDT`,
          remainingSeconds: 0,
        });
        return;
      }
      const packageHistory = await Promise.all(
        Array.from(
          { length: Number(packageHistoryLength) },
          (_, index) => v2Manager.getPackageHistoryAt(wallet, index),
        ),
      );
      const activeIncomeLimit = packageHistory.reduce(
        (total, record) => {
          const isActive = Boolean(record.active ?? record[5]);
          return isActive ? total + incomeLimitForPackage(record.amount ?? record[0]) : total;
        },
        0n,
      );
      const closedPackageLimit = packageHistory.reduce(
        (total, record) => {
          const isActive = Boolean(record.active ?? record[5]);
          return isActive ? total : total + incomeLimitForPackage(record.amount ?? record[0]);
        },
        0n,
      );
      const incomeHistory = await Promise.all(
        Array.from(
          { length: Number(incomeHistoryLength) },
          (_, index) => v2Ledger.getUserIncomeHistoryAt(wallet, index),
        ),
      );
      const totalClaimedIncome = incomeHistory.reduce(
        (total, record) => total + BigInt(record.amount ?? record[2] ?? 0n),
        0n,
      );
      const currentReadyIncome = BigInt(directReady)
        + BigInt(selfRoiReady)
        + BigInt(levelRoiReady)
        + BigInt(powerReady)
        + BigInt(rewardReady);
      // Lifetime non-Flush claimed income plus all ready income, less every
      // completed FIFO cap, is the progress of the still-active packages.
      const projectedActiveIncome = totalClaimedIncome + currentReadyIncome > closedPackageLimit
        ? totalClaimedIncome + currentReadyIncome - closedPackageLimit
        : 0n;
      const cappedActiveIncomeProgress = projectedActiveIncome > activeIncomeLimit
        ? activeIncomeLimit
        : projectedActiveIncome;
      const v2LatestBlock = await v2Provider.getBlock("latest");
      const v2RoiDay = Number(roiDayRaw) || 120;
      const v2Now = Number(v2LatestBlock?.timestamp ?? Math.floor(Date.now() / 1000));
      // V2 ROI boundaries are fixed from contract deployment, not from an
      // old-package history record. Using the immutable V2 start avoids the
      // old `record` reference that caused active plan reads to fall back.
      const v2RoiStart = Number(roiStartRaw);
      const v2Elapsed = Math.max(0, v2Now - v2RoiStart);
      const v2CycleProgress = v2Elapsed % v2RoiDay;
      const v2RemainingSeconds = v2CycleProgress === 0 ? v2RoiDay : v2RoiDay - v2CycleProgress;
      setPlanActivity({
        // Claimed/used income plus all currently ready V2 income, excluding Flush.
        progressText: `${toPercent2(cappedActiveIncomeProgress, activeIncomeLimit)}% / 100.00%`,
        activeStakeLabel: `Active income limit: ${formatEther2(activeIncomeLimit)} USDT`,
        selfRoiReadyLabel: "",
        remainingSeconds: v2RemainingSeconds,
      });
      return;

      const walletAddress = await getReadWalletAddress();

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        setPlanActivity({
          progressText: "0% / 0%",
          activeStakeLabel: "No active package",
          selfRoiReadyLabel: "Current Self ROI Ready: 0.0000 USDT",
          remainingSeconds: 0,
        });
        return;
      }

      const provider = new ethers.JsonRpcProvider(
        BSC_TESTNET.rpcUrls[1], BSC_TESTNET.chainId, { staticNetwork: true },
      );
      const packageManager = new ethers.Contract(
        PackageManagerAddress,
        PackageManagerABI,
        provider,
      );
      const packageManagerLens = new ethers.Contract(
        PackageManagerLensAddress,
        PackageManagerLensABI,
        provider,
      );

      const [lengthRaw, oneDayRaw, latestBlock] = await Promise.all([
        packageManagerLens.getStakeHistoryLength(walletAddress),
        packageManager.oneDay(),
        provider.getBlock("latest"),
      ]);

      const length = Number(lengthRaw ?? 0n);
      const oneDaySeconds = Number(oneDayRaw ?? 86400n) || 86400;
      const nowTs = Number(latestBlock?.timestamp ?? Math.floor(Date.now() / 1000));

      let activeIndex = -1;
      let activeInfo = null;

      for (let index = 0; index < length; index += 1) {
        const roiInfo = await packageManager.getStakeRoiInfo(walletAddress, index);
        const maxRoi = BigInt(roiInfo?.maxRoi ?? roiInfo?.[1] ?? 0n);
        const totalAccrued = BigInt(roiInfo?.totalAccrued ?? roiInfo?.[2] ?? 0n);

        if (maxRoi > 0n && totalAccrued < maxRoi) {
          activeIndex = index;
          activeInfo = roiInfo;
          break;
        }
      }

      if (activeIndex < 0 || !activeInfo) {
        setPlanActivity({
          progressText: "100% / 100%",
          activeStakeLabel: "All packages completed",
          selfRoiReadyLabel: "Current Self ROI Ready: 0.0000 USDT",
          remainingSeconds: 0,
        });
        return;
      }

      const stake = await packageManagerLens.getStakeHistoryAt(walletAddress, activeIndex);
      const stakeTimestamp = Number(stake?.timestamp ?? stake?.[7] ?? 0n);
      const packageValue = stake?.packageValue ?? stake?.[0] ?? 0n;

      const principal = BigInt(activeInfo?.principal ?? activeInfo?.[0] ?? 0n);
      const maxRoi = BigInt(activeInfo?.maxRoi ?? activeInfo?.[1] ?? 0n);
      const totalAccrued = BigInt(activeInfo?.totalAccrued ?? activeInfo?.[2] ?? 0n);

      const achievedPercentText = toPercent2(totalAccrued, maxRoi);
      const targetPercentText = toPercent2(maxRoi, principal);

      let remainingSeconds = 0;
      if (stakeTimestamp > 0 && oneDaySeconds > 0) {
        const elapsedSinceStake = Math.max(0, nowTs - stakeTimestamp);
        const cycleProgress = elapsedSinceStake % oneDaySeconds;
        remainingSeconds =
          cycleProgress === 0 ? oneDaySeconds : Math.max(0, oneDaySeconds - cycleProgress);
      }

      setPlanActivity({
        progressText: `${achievedPercentText}% / ${targetPercentText}%`,
        activeStakeLabel: `Active: ${formatEther2(packageValue)} (Package #${activeIndex + 1})`,
        selfRoiReadyLabel: "",
        remainingSeconds,
      });
    } catch {
      setPlanActivity({
        progressText: "0% / 0%",
        activeStakeLabel: "No active package",
        selfRoiReadyLabel: "Current Self ROI Ready: 0.0000 USDT",
        remainingSeconds: 0,
      });
    }
  }, []);

  const loadDayCycle = useCallback(async () => {
    try {
      const v2DayProvider = createBscReadProvider();
      const v2DayManager = new ethers.Contract(PackageManagerAddress, V2PackageManagerABI, v2DayProvider);
      const [roiDayRaw, roiStartRaw, v2LatestBlock] = await Promise.all([
        v2DayManager.ROI_DAY(),
        v2DayManager.roiStartTime(),
        v2DayProvider.getBlock("latest"),
      ]);
      const v2OneDaySeconds = Number(roiDayRaw) || 120;
      const v2Now = Number(v2LatestBlock?.timestamp ?? Math.floor(Date.now() / 1000));
      const v2Elapsed = Math.max(0, v2Now - Number(roiStartRaw));
      const v2Progress = v2Elapsed % v2OneDaySeconds;
      setDayCycle({ oneDaySeconds: v2OneDaySeconds, remainingSeconds: v2Progress === 0 ? v2OneDaySeconds : v2OneDaySeconds - v2Progress });
      return;

      const provider = new ethers.JsonRpcProvider(BSC_TESTNET.rpcUrls[0]);
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

      const [oneDayRaw, deployedAtRaw, latestBlock] = await Promise.all([
        packageManager.oneDay(),
        referralNetwork.deployedAt(),
        provider.getBlock("latest"),
      ]);

      const oneDaySeconds = Number(oneDayRaw ?? 86400n) || 86400;
      const blockTimestamp = Number(latestBlock?.timestamp ?? Math.floor(Date.now() / 1000));
      const deployedAtTimestamp = Number(deployedAtRaw ?? 0n);
      const elapsedSinceDeploy =
        deployedAtTimestamp > 0 ? Math.max(0, blockTimestamp - deployedAtTimestamp) : 0;
      const modulo = elapsedSinceDeploy % oneDaySeconds;
      const remainingSeconds =
        modulo === 0 && elapsedSinceDeploy > 0
          ? oneDaySeconds
          : Math.max(0, oneDaySeconds - modulo);

      setDayCycle({
        oneDaySeconds,
        remainingSeconds,
      });
    } catch {
      setDayCycle({
        oneDaySeconds: 86400,
        remainingSeconds: 0,
      });
    }
  }, []);

  const loadPackageWarnings = useCallback(async () => {
    try {
      const wallet = await getReadWalletAddress();
      if (!wallet || !ethers.isAddress(wallet)) {
        setPackageWarnings([]);
        setPurchaseSafety({ blocked: false, effectiveRemaining: 0n });
        return;
      }
      const v2WarningProvider = createBscReadProvider();
      const v2WarningManager = new ethers.Contract(PackageManagerAddress, V2PackageManagerABI, v2WarningProvider);
      const v2WarningLedger = new ethers.Contract(V2LedgerAddress, V2IncomeLedgerABI, v2WarningProvider);
      const [limit, historyLengthRaw, incomeHistoryLengthRaw, directReady, selfRoiReady, levelRoiReady, powerReady, rewardReady] = await Promise.all([
        v2WarningManager.totalIncomeLimit(wallet),
        v2WarningManager.getPackageHistoryLength(wallet),
        v2WarningLedger.getUserIncomeHistoryLength(wallet),
        v2WarningManager.getIncomeReady(wallet, 0),
        v2WarningManager.getIncomeReady(wallet, 1),
        v2WarningManager.getIncomeReady(wallet, 2),
        v2WarningManager.getIncomeReady(wallet, 3),
        v2WarningManager.getIncomeReady(wallet, 4),
      ]);
      const incomeLimit = BigInt(limit);
      const historyLength = Number(historyLengthRaw);
      const packageHistory = await Promise.all(
        Array.from(
          { length: historyLength },
          (_, index) => v2WarningManager.getPackageHistoryAt(wallet, index),
        ),
      );
      const activeIncomeLimit = packageHistory.reduce(
        (total, record) => {
          const isActive = Boolean(record.active ?? record[5]);
          return isActive ? total + incomeLimitForPackage(record.amount ?? record[0]) : total;
        },
        0n,
      );
      const closedPackageLimit = packageHistory.reduce(
        (total, record) => {
          const isActive = Boolean(record.active ?? record[5]);
          return isActive ? total : total + incomeLimitForPackage(record.amount ?? record[0]);
        },
        0n,
      );
      const incomeHistory = await Promise.all(
        Array.from(
          { length: Number(incomeHistoryLengthRaw) },
          (_, index) => v2WarningLedger.getUserIncomeHistoryAt(wallet, index),
        ),
      );
      const totalClaimedIncome = incomeHistory.reduce(
        (total, record) => total + BigInt(record.amount ?? record[2] ?? 0n),
        0n,
      );
      const currentReady =
        BigInt(directReady) +
        BigInt(selfRoiReady) +
        BigInt(levelRoiReady) +
        BigInt(powerReady) +
        BigInt(rewardReady);
      // Warning progress is the user's real position after all amounts that
      // are already ready for a claim. The claim transaction remains the
      // only place where the cap is enforced and overflow is flushed.
      const activeIncomeProgress = totalClaimedIncome + currentReady > closedPackageLimit
        ? totalClaimedIncome + currentReady - closedPackageLimit
        : 0n;
      const projectedUsed = activeIncomeProgress > activeIncomeLimit
        ? activeIncomeLimit
        : activeIncomeProgress;
      const projectedRemaining = activeIncomeLimit > projectedUsed
        ? activeIncomeLimit - projectedUsed
        : 0n;
      const capAlreadyCompleted = activeIncomeLimit !== 0n && activeIncomeProgress >= activeIncomeLimit;
      setPurchaseSafety({ blocked: false, effectiveRemaining: projectedRemaining });
      // When every FIFO package is exhausted the manager intentionally resets
      // totalIncomeLimit/Used to zero. Read the last history row so the user
      // still sees that their previous package completed and is now inactive.
      if (incomeLimit === 0n && historyLength > 0) {
        const lastPackage = await v2WarningManager.getPackageHistoryAt(wallet, historyLength - 1);
        const deactivatedAt = BigInt(lastPackage.deactivatedAt ?? lastPackage[2] ?? 0n);
        if (deactivatedAt !== 0n) {
          setPackageWarnings([{
            completed: true,
            inactive: true,
            packageAmount: BigInt(lastPackage.amount ?? lastPackage[0] ?? 0n),
          }]);
          return;
        }
      }
      setPackageWarnings(
        activeIncomeLimit === 0n
          ? []
            : capAlreadyCompleted
            ? [{ remaining: 0n, incomeLimit: activeIncomeLimit, projectedUsed: activeIncomeLimit, currentReady, completed: true }]
            : projectedRemaining <= activeIncomeLimit / 4n
              ? [{
                remaining: projectedRemaining,
                incomeLimit: activeIncomeLimit,
                projectedUsed,
                currentReady,
                completed: false,
                willComplete: projectedRemaining === 0n,
              }]
              : []
      );
      return;

      const walletAddress = await getReadWalletAddress();
      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        setPackageWarnings([]);
        setPurchaseSafety({ blocked: false, effectiveRemaining: 0n });
        return;
      }

      const provider = new ethers.JsonRpcProvider(
        BSC_TESTNET.rpcUrls[1], BSC_TESTNET.chainId, { staticNetwork: true },
      );
      const packageManager = new ethers.Contract(
        PackageManagerAddress,
        PackageManagerABI,
        provider,
      );
      const lens = new ethers.Contract(
        PackageManagerLensAddress,
        PackageManagerLensABI,
        provider,
      );
      const [incomeLimitStatus, pendingDirect, roiClaimable, levelClaimable, powerData, rewardData, minWithdrawRaw] = await Promise.all([
        lens.getIncomeLimitStatus(walletAddress),
        packageManager.pendingDirectIncomeToken(walletAddress),
        lens.getRoiClaimable(walletAddress),
        lens.getTotalLevelRoiClaimable(walletAddress),
        lens.getPowerIncomeClaimable(walletAddress),
        lens.getRewardIncomeClaimable(walletAddress),
        packageManager.minWithdrawUsd(),
      ]);
      const remainingToken = BigInt(incomeLimitStatus?.remainingToken ?? incomeLimitStatus?.[2] ?? 0n);
      const totalIncomeLimit = BigInt(incomeLimitStatus?.incomeLimitToken ?? incomeLimitStatus?.[0] ?? 0n);
      const pendingIncome =
        BigInt(pendingDirect ?? 0n) +
        BigInt(roiClaimable ?? 0n) +
        BigInt(levelClaimable ?? 0n) +
        BigInt(powerData?.claimable ?? powerData?.[0] ?? 0n) +
        BigInt(rewardData?.claimable ?? rewardData?.[0] ?? 0n);
      const effectiveRemaining =
        remainingToken > pendingIncome ? remainingToken - pendingIncome : 0n;
      const minWithdraw = BigInt(minWithdrawRaw ?? 0n);
      setPurchaseSafety({
        blocked: effectiveRemaining > 0n && effectiveRemaining < minWithdraw,
        effectiveRemaining,
      });

      // Use the contract's aggregate limit across every package. A warning is
      // based on the combined cycle, not on an individual package index.
      const combinedThreshold = totalIncomeLimit / 4n;
      setPackageWarnings(
        totalIncomeLimit > 0n &&
          remainingToken > 0n &&
          remainingToken <= combinedThreshold
          ? [{ remaining: remainingToken, incomeLimit: totalIncomeLimit }]
          : [],
      );
    } catch {
      setPackageWarnings([]);
      setPurchaseSafety({ blocked: false, effectiveRemaining: 0n });
    }
  }, []);

  useEffect(() => {
    const formatUtc = () =>
      new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "UTC",
      })
        .format(new Date())
        .replace(",", "") + " UTC";

    setUtcNow(formatUtc());
    const timer = setInterval(() => {
      setUtcNow(formatUtc());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadPlanActivity();
    loadDayCycle();
    loadPackageWarnings();

    const refreshTimer = setInterval(() => {
      loadPlanActivity();
      loadDayCycle();
      loadPackageWarnings();
    }, 30000);

    const countdownTimer = setInterval(() => {
      setPlanActivity((prev) => ({
        ...prev,
        remainingSeconds: prev.remainingSeconds > 0 ? prev.remainingSeconds - 1 : 0,
      }));
      setDayCycle((prev) => ({
        ...prev,
        remainingSeconds:
          prev.remainingSeconds > 1
            ? prev.remainingSeconds - 1
            : 0,
      }));
    }, 1000);

    const handleAccountsChanged = () => {
      loadPlanActivity();
      loadDayCycle();
      loadPackageWarnings();
    };

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
    }

    return () => {
      clearInterval(refreshTimer);
      clearInterval(countdownTimer);
      if (window.ethereum) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
    };
  }, [loadDayCycle, loadPackageWarnings, loadPlanActivity]);

  const ensureBscTestnet = async () => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: WALLET_ADD_CHAIN_PARAMS.chainId }],
      });
    } catch (switchError) {
      if (switchError?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [WALLET_ADD_CHAIN_PARAMS],
        });
      } else {
        throw switchError;
      }
    }
  };

  const handleBuyPackage = async () => {
    if (!window.ethereum) {
      setBuyStatus("MetaMask not found.");
      return;
    }

    try {
      setIsBuying(true);
      setBuyStatus("Connecting wallet...");

      // Do not trigger an unnecessary MetaMask connect popup for a wallet
      // that is already connected to this site.
      let accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (!accounts?.[0]) {
        accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      }
      await ensureBscTestnet();
      const userAddress = accounts?.[0] || "";
      if (!ethers.isAddress(userAddress)) throw new Error("Wallet account not available");

      // A package can only be purchased after registration. This check must
      // run before direct-buy mode so an unregistered wallet never sends an
      // opaque wallet request that results in a generic RPC error.
      setBuyStatus("Checking registration...");
      const registrationProvider = createBscReadProvider();
      const registrationContract = new ethers.Contract(
        ReferralNetworkAddress,
        V2ReferralRegistryABI,
        registrationProvider,
      );
      const registration = await registrationContract.users(userAddress);
      const isRegistered = Boolean(registration?.exists ?? registration?.[8]);
      const referrer = registration?.referral ?? registration?.[1] ?? ethers.ZeroAddress;

      if (!isRegistered) {
        setBuyStatus("Buy blocked: this wallet is not registered. Please register with a valid referral link first.");
        return;
      }

      if (referrer.toLowerCase() === ethers.ZeroAddress.toLowerCase()) {
        setBuyStatus("Buy blocked: this wallet has no valid referrer. Please contact support.");
        return;
      }

      if (purchaseSafety.blocked) {
        setBuyStatus(
          `Package activation is paused. Only ${ethers.formatEther(purchaseSafety.effectiveRemaining)} USDT will remain after pending income. Wait for the income cycle to complete, withdraw the full available income, then activate a new package.`,
        );
        return;
      }

      // Check the exact USDT allowance first. A new wallet needs an
      // approval transaction before Package Manager can transfer its USDT.
      const tokenReadContract = new ethers.Contract(
          TokenAddress,
          [
            "function decimals() view returns (uint8)",
            "function balanceOf(address owner) view returns (uint256)",
            "function allowance(address owner,address spender) view returns (uint256)",
            "function approve(address spender,uint256 amount) returns (bool)",
          ],
          registrationProvider,
      );
      setBuyStatus("Checking USDT balance and approval...");
      const [tokenDecimals, tokenBalance, currentAllowance] = await Promise.all([
          tokenReadContract.decimals(),
          tokenReadContract.balanceOf(userAddress),
          tokenReadContract.allowance(userAddress, PackageManagerAddress),
      ]);
      const directPackageAmount = ethers.parseUnits(selectedPackage, Number(tokenDecimals));

      if (tokenBalance < directPackageAmount) {
        setBuyStatus(
            `Insufficient USDT balance. ${selectedPackage} USDT is required for this package.`,
        );
        return;
      }

      if (currentAllowance < directPackageAmount) {
        setBuyStatus("Approve USDT in your wallet first...");
        const tokenInterface = new ethers.Interface([
          "function approve(address spender,uint256 amount) returns (bool)",
        ]);
        const approveHash = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [{
            from: userAddress,
            to: TokenAddress,
            data: tokenInterface.encodeFunctionData("approve", [PackageManagerAddress, directPackageAmount]),
          }],
        });
        const approveReceipt = await registrationProvider
          .waitForTransaction(approveHash, 1, 180000)
          .catch(() => null);
        if (!approveReceipt || approveReceipt.status !== 1) {
          setBuyStatus("USDT approval is pending or failed. Check wallet Activity, then try Buy again.");
          return;
        }
      }

      // No gas field is sent; MetaMask estimates and sets the gas limit itself.
      const directInterface = new ethers.Interface(V2PackageManagerABI);
      setBuyStatus("Confirm Buy transaction in your wallet...");
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
          params: [{
            from: userAddress,
            to: PackageManagerAddress,
            data: directInterface.encodeFunctionData("buyPackage", [directPackageAmount]),
        }],
      });
      const buyReceipt = await registrationProvider
        .waitForTransaction(txHash, 1, 180000)
        .catch(() => null);
      if (!buyReceipt || buyReceipt.status !== 1) {
        setBuyStatus("Buy transaction is pending or failed. Check wallet Activity, then try Buy again.");
        return;
      }
      setBuyStatus("Package activated successfully. Refreshing dashboard...");
      await Promise.all([loadPlanActivity(), loadDayCycle(), loadPackageWarnings()]);
      window.dispatchEvent(new Event("btf:v2-data-changed"));
      // Other dashboard cards use independent reads. A complete reload after
      // the confirmed receipt ensures every card uses the new chain state.
      window.setTimeout(() => window.location.reload(), 700);

    } catch (error) {
      console.error("Buy package failed:", error);
      const rawMessage = error?.shortMessage || error?.reason || error?.message || "";
      setBuyStatus(
        rawMessage.toLowerCase().includes("could not coalesce error")
          ? "Wallet/RPC rejected the request. Please reconnect the wallet on BSC Testnet and try again."
          : rawMessage || "Buy failed.",
      );
    } finally {
      setIsBuying(false);
    }
  };

  const dayProgress =
    dayCycle.oneDaySeconds > 0
      ? ((dayCycle.oneDaySeconds - dayCycle.remainingSeconds) / dayCycle.oneDaySeconds) * 100
      : 0;

  return (
    <div className="dashboard-top">
      <div className="hamburger" onClick={() => SetSidebarOpen(true)}>
        <span className="icon">
          <i className="bi bi-list"></i>
        </span>
      </div>

      {/* LEFT */}
      <div className="dt-left">
        <p className="small-title">Buy Package</p>
        <select
          className="package-select"
          value={selectedPackage}
          onChange={(e) => setSelectedPackage(e.target.value)}
        >
          {packageOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button className="create-btn" onClick={handleBuyPackage} disabled={isBuying}>
          {isBuying ? "Processing..." : "Buy"}
        </button>
        {buyStatus && <p className="buy-status">{buyStatus}</p>}
        {packageWarnings.map((warning) => (
          <div
            className={`package-warning${warning.completed ? " package-warning-critical" : ""}`}
            key="combined-income-limit"
            role={warning.completed ? "alert" : "status"}
          >
            <strong>{warning.completed ? "Income Limit Completed" : warning.willComplete ? "Income Limit Will Complete on Claim" : "Package Nearing Completion"}</strong>
            {warning.completed ? (
              <>
                <span>
                  {warning.inactive
                    ? `Your ${formatEther2(warning.packageAmount)} USDT package income limit is complete and the package is inactive.`
                    : `Your combined income limit of ${formatEther2(warning.incomeLimit)} USDT is complete.`}
                </span>
                <small>
                  {warning.inactive
                    ? "Any old or pending income from this completed package will be recorded as Flush when claimed. Activate a new package to earn again."
                    : "Any further income will be recorded as Flush when the related income is claimed."}
                </small>
              </>
            ) : (
              <>
                {/* <span>
                  Claimed + current ready income: {formatEther2(warning.projectedUsed)} / {formatEther2(warning.incomeLimit)} USDT.
                  {` ${formatEther2(warning.remaining)} USDT`} remains before the income limit.
                </span> */}
                <small>
                  {warning.willComplete
                    ? "Current ready income will complete this limit. Any amount above the remaining limit will be recorded as Flush when claimed."
                    : "This includes Direct, Self ROI, Level ROI, Power and Reward income that is already ready to claim."}
                </small>
              </>
            )}
          </div>
        ))}
        {purchaseSafety.blocked && (
          <div className="package-warning package-warning-critical" role="alert">
            <strong>Package Activation Temporarily Paused</strong>
            <span>
              Pending income will leave only {formatEther2(purchaseSafety.effectiveRemaining)} USDT
              remaining in this income cycle.
            </span>
            <small>
              Wait for the cycle to complete, withdraw the full available income,
              then activate a new package.
            </small>
          </div>
        )}
      </div>

      {/* CENTER */}
      <div className="dt-center">
        <p className="date-pill">
          Today : <span>{utcNow}</span>
        </p>
        <h1 className="title">Dashboard</h1>
        <div className="day-cycle-wrap">
          <div
            className="day-cycle-ring"
            style={{
              "--cycle-progress": `${Math.max(0, Math.min(100, dayProgress))}%`,
            }}
          >
            <div className="day-cycle-ring-inner">
              <span className="day-cycle-label">Blockchain Day Ends In</span>
              <strong className="day-cycle-time">
                {formatCountdown(dayCycle.remainingSeconds)}
              </strong>
            </div>
          </div>
        </div>
        {/* <p className="hello">Hello, username!</p> */}
        <div className="arrow"></div>
      </div>

      {/* RIGHT */}
      <div className="dt-right">
        <img src={circleimg} alt="" />
        <p className="small-title">Plan Percentage</p>
        <h3 className="upgrade">
          <span>{planActivity.progressText}</span>
        </h3>
        <p className="small-title">{planActivity.activeStakeLabel}</p>

        {/*
        <div className="timer">
          <div className="box">
            <span>{hourValue}</span>
            <p>hour</p>
          </div>
          <div className="box">
            <span>{minuteValue}</span>
            <p>min</p>
          </div>
          <div className="box">
            <span>{secondValue}</span>
            <p>sec</p>
          </div>
        </div>
        */}
      </div>
    </div>
  );
};

export default DashboardTop;
