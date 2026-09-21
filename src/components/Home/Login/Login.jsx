import image from "/dashboardimg/logo.png";
import "./Login.css";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { clearRememberedWalletAddress, rememberWalletAddress } from "../../../blockchain/readProvider";
import { WALLET_ADD_CHAIN_PARAMS } from "../../../blockchain/bscTestnetConfig";
import ReferralNetworkABI from "../../../blockchain/referralNetworkABI.json";
import { ReferralNetworkAddress } from "../../../blockchain/address";
import { readRegistration } from "../../../blockchain/registrationReader";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [walletAddress, setWalletAddress] = useState("");
  const [referralAddress, setReferralAddress] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const loginCheckVersion = useRef(0);
  const [registrationStatus, setRegistrationStatus] = useState("idle");
  const [toast, setToast] = useState({ message: "", type: "", show: false });
  const [registerMessage, setRegisterMessage] = useState({
    text: "",
    type: "",
  });

  const showToast = (message, type = "error") => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast({ message: "", type: "", show: false });
    }, 3000);
  };

  const showRegisterMessage = (text, type = "error") => {
    setRegisterMessage({ text, type });
  };

  const ensureBscTestnet = async () => {
    const currentChain = await window.ethereum.request({ method: "eth_chainId" });
    if (BigInt(currentChain) === BigInt(WALLET_ADD_CHAIN_PARAMS.chainId)) return;
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
    const selectedChain = await window.ethereum.request({ method: "eth_chainId" });
    if (BigInt(selectedChain) !== BigInt(WALLET_ADD_CHAIN_PARAMS.chainId)) {
      throw new Error("Please select BSC Testnet in your wallet and try again.");
    }
  };

  const formatWalletAddress = (address) => {
    if (!address) {
      return "Connect Wallet";
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const checkAndRedirectIfRegistered = useCallback(async (address) => {
    const version = ++loginCheckVersion.current;
    if (!address || !ethers.isAddress(address)) {
      setRegistrationStatus("idle");
      return;
    }

    setRegistrationStatus("checking");
    try {
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (version !== loginCheckVersion.current) return;
      if (BigInt(chainId) !== BigInt(WALLET_ADD_CHAIN_PARAMS.chainId)) {
        setRegistrationStatus("error");
        setRegisterMessage({
          text: "Switch to BSC Testnet or click your wallet address to continue.",
          type: "error",
        });
        return;
      }

      const userData = await readRegistration("users", address);
      const isRegistered = userData?.exists ?? userData?.[8] ?? false;

      if (version === loginCheckVersion.current) {
        setRegistrationStatus(isRegistered ? "registered" : "unregistered");
        setRegisterMessage({ text: "", type: "" });
        if (isRegistered) navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      if (version !== loginCheckVersion.current) return;
      setRegistrationStatus("error");
      setRegisterMessage({ text: error?.message || "Unable to check registration. Please reconnect your wallet.", type: "error" });
    }
  }, [navigate]);

  const handleConnectWallet = async () => {
    if (!window.ethereum) {
      showToast("MetaMask not found. Please install MetaMask first.");
      return;
    }

    try {
      setIsConnecting(true);
      await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      await ensureBscTestnet();
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      const connectedAddress = accounts?.[0] || "";
      setWalletAddress(connectedAddress);
      rememberWalletAddress(connectedAddress);
      await checkAndRedirectIfRegistered(connectedAddress);
    } catch (error) {
      const message =
        error?.shortMessage ||
        error?.reason ||
        error?.message ||
        "Wallet connection failed.";
      showToast(message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = () => {
    ++loginCheckVersion.current;
    setRegistrationStatus("idle");
    setWalletAddress("");
    clearRememberedWalletAddress();
    setRegisterMessage({ text: "", type: "" });
  };

  const handleRegister = async () => {
    if (isRegistering || registrationStatus !== "unregistered") return;
    const referral = referralAddress.trim();
    setRegisterMessage({ text: "", type: "" });

    if (!window.ethereum) {
      showToast("MetaMask not found. Please install MetaMask first.");
      return;
    }

    if (!walletAddress) {
      showToast("Please connect wallet first.");
      return;
    }

    try {
      setIsRegistering(true);
      await ensureBscTestnet();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      const currentUserData = await readRegistration("users", signerAddress);
      if (currentUserData?.exists ?? currentUserData?.[8] ?? false) {
        navigate("/dashboard", { replace: true });
        return;
      }
      if (!ethers.isAddress(referral)) {
        showRegisterMessage("Invalid referral address.");
        return;
      }
      if (referral.toLowerCase() === signerAddress.toLowerCase()) {
        showRegisterMessage("Self referral is not allowed.");
        return;
      }
      const referralContract = new ethers.Contract(
        ReferralNetworkAddress,
        ReferralNetworkABI,
        signer,
      );

      const rootAddress = await readRegistration("rootAddress");
      const userData = await readRegistration("users", referral);
      const isRootReferral =
        rootAddress?.toLowerCase() === referral.toLowerCase();
      const hasValidReferral = userData?.exists ?? userData?.[8] ?? false;

      if (!hasValidReferral && !isRootReferral) {
        showRegisterMessage("Invalid referral address.");
        return;
      }

      const tx = await referralContract.register(referral);
      await tx.wait();
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts?.[0]?.toLowerCase() !== signerAddress.toLowerCase()) {
        setWalletAddress(accounts?.[0] || "");
        await checkAndRedirectIfRegistered(accounts?.[0] || "");
        return;
      }
      setRegistrationStatus("registered");
      showRegisterMessage("Register successful.", "success");
      showToast("Register successful.", "success");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const rawMessage =
        error?.shortMessage ||
        error?.reason ||
        error?.message ||
        "Register transaction failed.";
      const normalizedMessage = String(rawMessage).toLowerCase();
      let message = rawMessage;

      if (normalizedMessage.includes("missing revert data")) {
        message = "Register failed. Please check if the wallet is already registered or the referral address is invalid.";
      }

      showRegisterMessage(message);
    } finally {
      setIsRegistering(false);
    }
  };

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum) {
      return;
    }

    let disposed = false;
    let syncVersion = 0;
    const checkVersion = loginCheckVersion;

    const syncWallet = async (changedAccounts) => {
      const version = ++syncVersion;
      ++loginCheckVersion.current;
      setRegistrationStatus("checking");
      setRegisterMessage({ text: "", type: "" });
      try {
        const accounts = changedAccounts ?? await ethereum.request({ method: "eth_accounts" });
        if (disposed || version !== syncVersion) return;
        const connectedAddress = accounts?.[0] || "";
        setWalletAddress(connectedAddress);
        if (connectedAddress) rememberWalletAddress(connectedAddress);
        await checkAndRedirectIfRegistered(connectedAddress);
      } catch (error) {
        if (disposed || version !== syncVersion) return;
        setRegistrationStatus("error");
        setRegisterMessage({
          text: error?.shortMessage || error?.message || "Unable to check registration. Click your wallet address to retry.",
          type: "error",
        });
      }
    };

    const handleAccountsChanged = (accounts) => { void syncWallet(accounts); };
    const handleChainChanged = () => { void syncWallet(); };
    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);
    syncWallet();

    return () => {
      disposed = true;
      ++checkVersion.current;
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [checkAndRedirectIfRegistered]);

  useEffect(() => {
    const refFromUrl = searchParams.get("ref");
    if (refFromUrl && ethers.isAddress(refFromUrl)) {
      setReferralAddress(refFromUrl);
    }
  }, [searchParams]);

  return (
    <div className="login-wrapper">
      <div className="crypto-bg">
        {toast.show && (
          <div className={`login-toast ${toast.type}`}>{toast.message}</div>
        )}
        <div className="bg-waves"></div>

        {/* Left Arrow */}
        <div className="arrow arrow-left"></div>

        {/* Right Arrow */}
        <div className="arrow arrow-right"></div>

        {/* Your card / content */}
        <div className="login-header">
          <div className="back">
            <Link to="/" className="link">
              <span className="icon">
                <i class="bi bi-arrow-90deg-left"></i>
              </span>{" "}
              <p>Home</p>
            </Link>
          </div>
          <div className="social-media">
            <div className="content">
              <span className="icon">
                <i className="bi bi-send"></i>
              </span>
              <p>Telegram Group</p>
            </div>

            <div className="content">
              <span className="icon">
                <i className="bi bi-send"></i>
              </span>
              <p>Telegram Chart</p>
            </div>

            <div className="content">
              <span className="icon">
                <i className="bi bi-send"></i>
              </span>
              <p>Telegram Support</p>
            </div>
          </div>
          <div className="login-logo">
            <img src={image} alt="" />
            {/* <p>LOGOTYPE</p> */}
          </div>
        </div>
        <div className="login-card">
          <h1>Login To Your Personal Account</h1>
          <p>
            {!walletAddress ? "Connect wallet to continue"
              : registrationStatus === "unregistered" ? "Enter referral address to register"
              : registrationStatus === "registered" ? "Opening dashboard..."
              : registrationStatus === "error" ? "Click your wallet address to retry"
              : "Checking registration..."}
          </p>
          <button onClick={handleConnectWallet} disabled={isConnecting}>
            {isConnecting ? "Connecting..." : formatWalletAddress(walletAddress)}
          </button>
          {walletAddress && (
            <button className="disconnect-btn" onClick={handleDisconnectWallet}>
              Disconnect
            </button>
          )}
          <div className="form-grid">
            {walletAddress && registrationStatus === "unregistered" && (
              <input
                type="text"
                placeholder="Enter Referral Wallet Address"
                value={referralAddress}
                onChange={(e) => {
                  setReferralAddress(e.target.value);
                  if (registerMessage.text) {
                    setRegisterMessage({ text: "", type: "" });
                  }
                }}
              />
            )}
          </div>
          {walletAddress && (
            <>
              {registrationStatus === "unregistered" && (
              <button onClick={handleRegister} disabled={isRegistering || registrationStatus !== "unregistered"}>
                {isRegistering ? "Registering..." : "Register"}
              </button>
              )}
              {registerMessage.text && (
                <p className={`register-message ${registerMessage.type}`}>
                  {registerMessage.text}
                </p>
              )}
            </>
          )}

          {/* <p className="signup-text">
            Don't have an account, please{" "}
            <Link to="/signup" className="link">
              Signup
            </Link>
          </p> */}
        </div>
      </div>
    </div>
  );
};

export default Login;
