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
import {
  PackageManagerAddress,
  PackageManagerLensAddress,
  ReferralNetworkAddress,
  TokenAddress,
} from "../../blockchain/address";
import { BSC_TESTNET, WALLET_ADD_CHAIN_PARAMS } from "../../blockchain/bscTestnetConfig";
import { getReadWalletAddress } from "../../blockchain/readProvider";

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
      return formatNumber2(Number(scaled) / 100);
    } catch {
      return "0.00";
    }
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
        remainingSeconds: 0,
      });
      return;
    }

    try {
      // V2-only dashboard plan data.
      const wallet = await getReadWalletAddress();
      if (!wallet || !ethers.isAddress(wallet)) throw new Error("WALLET");
      const v2Provider = new ethers.JsonRpcProvider(BSC_TESTNET.rpcUrls[1], BSC_TESTNET.chainId, { staticNetwork: true });
      const v2Manager = new ethers.Contract(PackageManagerAddress, V2PackageManagerABI, v2Provider);
      const [historyLengthRaw, roiDayRaw] = await Promise.all([
        v2Manager.getPackageHistoryLength(wallet),
        v2Manager.ROI_DAY(),
      ]);
      const historyLength = Number(historyLengthRaw);
      if (historyLength === 0) {
        setPlanActivity({ progressText: "0% / 300%", activeStakeLabel: "No active package", remainingSeconds: 0 });
        return;
      }
      const record = await v2Manager.getPackageHistoryAt(wallet, historyLength - 1);
      if (!record.active) {
        setPlanActivity({ progressText: "300% / 300%", activeStakeLabel: "Package inactive", remainingSeconds: 0 });
        return;
      }
      const v2LatestBlock = await v2Provider.getBlock("latest");
      const v2RoiDay = Number(roiDayRaw) || 120;
      const v2Now = Number(v2LatestBlock?.timestamp ?? Math.floor(Date.now() / 1000));
      const v2BoughtAt = Number(record.purchasedAt);
      const v2Elapsed = Math.max(0, v2Now - v2BoughtAt);
      const v2CycleProgress = v2Elapsed % v2RoiDay;
      const v2RemainingSeconds = v2CycleProgress === 0 ? v2RoiDay : v2RoiDay - v2CycleProgress;
      setPlanActivity({
        progressText: `${toPercent2(record.roiGenerated, record.amount)}% / 300.0000%`,
        activeStakeLabel: `Active: ${formatEther2(record.amount)} USDT (Package #${historyLength})`,
        remainingSeconds: v2RemainingSeconds,
      });
      return;

      const walletAddress = await getReadWalletAddress();

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        setPlanActivity({
          progressText: "0% / 0%",
          activeStakeLabel: "No active package",
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
        remainingSeconds,
      });
    } catch {
      setPlanActivity({
        progressText: "0% / 0%",
        activeStakeLabel: "No active package",
        remainingSeconds: 0,
      });
    }
  }, []);

  const loadDayCycle = useCallback(async () => {
    try {
      const v2DayProvider = new ethers.JsonRpcProvider(BSC_TESTNET.rpcUrls[1], BSC_TESTNET.chainId, { staticNetwork: true });
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
      const v2WarningProvider = new ethers.JsonRpcProvider(BSC_TESTNET.rpcUrls[1], BSC_TESTNET.chainId, { staticNetwork: true });
      const v2WarningManager = new ethers.Contract(PackageManagerAddress, V2PackageManagerABI, v2WarningProvider);
      const [limit, used] = await Promise.all([
        v2WarningManager.totalIncomeLimit(wallet),
        v2WarningManager.totalIncomeUsed(wallet),
      ]);
      const remaining = BigInt(limit) > BigInt(used) ? BigInt(limit) - BigInt(used) : 0n;
      setPurchaseSafety({ blocked: false, effectiveRemaining: remaining });
      setPackageWarnings(
        BigInt(limit) !== 0n && remaining !== 0n && remaining <= BigInt(limit) / 4n
          ? [{ remaining, incomeLimit: BigInt(limit) }]
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

      await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureBscTestnet();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      // A package can only be purchased after registration. This check must
      // run before direct-buy mode so an unregistered wallet never sends an
      // opaque wallet request that results in a generic RPC error.
      setBuyStatus("Checking registration...");
      const registrationProvider = new ethers.JsonRpcProvider(
        BSC_TESTNET.rpcUrls[1], BSC_TESTNET.chainId, { staticNetwork: true },
      );
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
        const approveTx = await tokenReadContract
          .connect(signer)
          .approve(PackageManagerAddress, directPackageAmount);
        const approveReceipt = await registrationProvider
          .waitForTransaction(approveTx.hash, 1, 180000)
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
      setBuyStatus("Buy transaction sent successfully.");

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
          <div className="package-warning" key="combined-income-limit" role="status">
            <strong>Package Nearing Completion</strong>
            <span>
              Your combined packages have {formatEther2(warning.remaining)} USDT
              remaining out of a {` ${formatEther2(warning.incomeLimit)} USDT`}
              income limit.
            </span>
            <small>
              Please prepare your next package activation. Do not activate a new
              package or withdraw a partial amount when the remaining income is
              below the withdrawal minimum. Wait for this income cycle to complete,
              withdraw the full available income, then activate a new package.
            </small>
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
