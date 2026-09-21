import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import ReferralNetworkABI from "../blockchain/referralNetworkABI.json";
import { ReferralNetworkAddress } from "../blockchain/address";
import { BSC_MAINNET } from "../blockchain/bscMainnetConfig";
import { getReadWalletAddress } from "../blockchain/readProvider";
import user from "/dashboardimg/user.png";

const LeftSidebar = ({ sidebarOpen, SetSidebarOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [userId, setUserId] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const formatWalletAddress = (address) => {
    if (!address) {
      return "Not Connected";
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleNavItemClick = () => {
    if (typeof window !== "undefined" && window.innerWidth <= 991) {
      SetSidebarOpen(false);
    }
  };

  useEffect(() => {
    if (!window.ethereum) {
      return;
    }

    const loadWallet = async () => {
      const address = await getReadWalletAddress();
      setWalletAddress(address);

      if (!address || !ethers.isAddress(address)) {
        setUserId("");
        return;
      }

      try {
        const provider = new ethers.JsonRpcProvider(
          BSC_MAINNET.rpcUrls[1], BSC_MAINNET.chainId, { staticNetwork: true },
        );
        const referralNetwork = new ethers.Contract(
          ReferralNetworkAddress,
          ReferralNetworkABI,
          provider,
        );
        const fetchedUserId = await referralNetwork.addressToId(address);
        setUserId(String(fetchedUserId ?? ""));
      } catch {
        setUserId("");
      }
    };

    const handleAccountsChanged = async (accounts) => {
      const address = accounts?.[0] || "";
      setWalletAddress(address);

      if (!address || !ethers.isAddress(address)) {
        setUserId("");
        return;
      }

      try {
        const provider = new ethers.JsonRpcProvider(
          BSC_MAINNET.rpcUrls[1], BSC_MAINNET.chainId, { staticNetwork: true },
        );
        const referralNetwork = new ethers.Contract(
          ReferralNetworkAddress,
          ReferralNetworkABI,
          provider,
        );
        const fetchedUserId = await referralNetwork.addressToId(address);
        setUserId(String(fetchedUserId ?? ""));
      } catch {
        setUserId("");
      }
    };

    loadWallet();
    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  useEffect(() => {
    const path = location.pathname.toLowerCase();

    if (path.startsWith("/income/")) {
      setActiveDropdown("income");
      return;
    }

    if (path.startsWith("/team/")) {
      setActiveDropdown("team");
      return;
    }

    if (path === "/withdrawal" || path === "/withdrawal-history") {
      setActiveDropdown("withdrawal");
      return;
    }

    setActiveDropdown(null);
  }, [location.pathname]);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    setWalletAddress("");
    setUserId("");
    SetSidebarOpen(false);
    navigate("/login", { replace: true });

    try {
      if (window.ethereum) {
        await window.ethereum.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      }
    } catch {
      // Some wallets do not support revoke; continue with redirect.
    }
  };

  return (
    <>
      <div className={`left-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="profile-section">
          <div className="account">
            {sidebarOpen && (
              <span className="icon" onClick={() => SetSidebarOpen(false)}>
                <i className="bi bi-x-lg"></i>
              </span>
            )}
            <h4>My Account</h4>
            <Link
              to="#"
              className="logout"
              aria-disabled={isLoggingOut}
              onClick={(e) => {
                e.preventDefault();
                handleLogout();
              }}
            >
              {isLoggingOut ? "Logging out..." : "Logout"}{" "}
              <i className="bi bi-box-arrow-right"></i>
            </Link>
          </div>

          <div className="profile-info">
            <span className="icon">
              <img src={user} alt="" />
            </span>
            <p className="username">{userId ? `User ID: ${userId}` : "User ID: --"}</p>
            <p className="username">{formatWalletAddress(walletAddress)}</p>
            <p className="email">{walletAddress || "Wallet not connected"}</p>
          </div>
        </div>

        <div className="left-navbar">
          <NavLink
            to="/dashboard"
            end
            className="nav"
            onClick={handleNavItemClick}
          >
            <p className="nav-item">
              <i className="bi bi-laptop"></i> Dashboard
            </p>
          </NavLink>

          <NavLink
            to="/activation"
            className="nav"
            onClick={handleNavItemClick}
          >
            <p className="nav-item">
              <i className="bi bi-bar-chart-line"></i> Activation
            </p>
          </NavLink>

          <NavLink
            to="/tree"
            className="nav"
            onClick={handleNavItemClick}
          >
            <p className="nav-item">
              <i className="bi bi-diagram-3"></i> Tree
            </p>
          </NavLink>

          <div className="nav-dropdown">
            <div
              className="nav nav-parent"
              onClick={() =>
                setActiveDropdown(activeDropdown === "team" ? null : "team")
              }
            >
              <p className="nav-item">
                <i className="bi bi-people"></i>
                Team
                <i
                  className={`bi bi-chevron-${activeDropdown === "team" ? "up" : "down"}`}
                />
              </p>
            </div>

            {activeDropdown === "team" && (
              <div className="dropdown open team-dropdown">
                <NavLink to="/team/my-team" className="nav" onClick={handleNavItemClick}>
                  <p className="nav-item sub">My Team</p>
                </NavLink>

                {/* <NavLink to="/team/My Direct" className="nav">
                  <p className="nav-item sub">My Direct</p>
                </NavLink> */}
              </div>
            )}
          </div>

          <NavLink
            to="/my-direct"
            className="nav"
            onClick={handleNavItemClick}
          >
            <p className="nav-item">
              <i className="bi bi-briefcase"></i> My Direct
            </p>
          </NavLink>

          <div className="nav-dropdown">
            <div
              className="nav nav-parent"
              onClick={() =>
                setActiveDropdown(activeDropdown === "income" ? null : "income")
              }
            >
              <p className="nav-item">
                <i className="bi bi-cash-coin"></i>
                Income
                <i
                  className={`bi bi-chevron-${activeDropdown === "income" ? "up" : "down"}`}
                />
              </p>
            </div>

            {activeDropdown === "income" && (
              <div className="dropdown open income-dropdown">
                <NavLink to="/income/income-1" className="nav" onClick={handleNavItemClick}>
                  <p className="nav-item sub">Direct Income</p>
                </NavLink>

                <NavLink to="/income/income-2" className="nav" onClick={handleNavItemClick}>
                  <p className="nav-item sub">Self ROI Income</p>
                </NavLink>

                <NavLink to="/income/income-3" className="nav" onClick={handleNavItemClick}>
                  <p className="nav-item sub">Level ROI Income</p>
                </NavLink>

                <NavLink to="/income/income-4" className="nav" onClick={handleNavItemClick}>
                  <p className="nav-item sub">Power Details</p>
                </NavLink>

                <NavLink
                  to="/income/power-income-withdraw"
                  className="nav"
                  onClick={handleNavItemClick}
                >
                  <p className="nav-item sub">Power Income</p>
                </NavLink>

                <NavLink to="/income/income-6" className="nav" onClick={handleNavItemClick}>
                  <p className="nav-item sub">Reward Details</p>
                </NavLink>

                <NavLink to="/income/income-5" className="nav" onClick={handleNavItemClick}>
                  <p className="nav-item sub">Reward Income</p>
                </NavLink>

                <NavLink to="/income/v2-claim" className="nav" onClick={handleNavItemClick}>
                  <p className="nav-item sub">Claim Income</p>
                </NavLink>

                <NavLink to="/income/v2-claim-history" className="nav" onClick={handleNavItemClick}>
                  <p className="nav-item sub">Claim History</p>
                </NavLink>

                <NavLink to="/income/flush-income" className="nav" onClick={handleNavItemClick}>
                  <p className="nav-item sub">Flush Income</p>
                </NavLink>
              </div>
            )}
          </div>

          <div className="nav-dropdown">
            <div
              className="nav nav-parent"
              onClick={() =>
                setActiveDropdown(
                  activeDropdown === "withdrawal" ? null : "withdrawal",
                )
              }
            >
              <p className="nav-item">
                <i className="bi bi-cash-coin"></i>
                Withdrawal
                <i
                  className={`bi bi-chevron-${activeDropdown === "withdrawal" ? "up" : "down"}`}
                />
              </p>
            </div>

            {activeDropdown === "withdrawal" && (
              <div className="dropdown open withdrawal-dropdown">
                <NavLink
                  to="/withdrawal"
                  className="nav"
                  onClick={handleNavItemClick}
                >
                  <p className="nav-item sub">Withdrawal</p>
                </NavLink>

                <NavLink
                  to="/withdrawal-history"
                  className="nav"
                  onClick={handleNavItemClick}
                >
                  <p className="nav-item sub">Withdrawal History</p>
                </NavLink>
              </div>
            )}
          </div>

          {/* <div className="nav-dropdown">
            <div
              className="nav nav-parent"
              onClick={() =>
                setActiveDropdown(activeDropdown === "lock" ? null : "lock")
              }
            >
              <p className="nav-item">
                <i className="bi bi-lock-fill"></i>
                Lock
                <i
                  className={`bi bi-chevron-${activeDropdown === "lock" ? "up" : "down"}`}
                />
              </p>
            </div>

            {activeDropdown === "lock" && (
              <div className="dropdown open">
                <NavLink
                  to="/lock"
                  className="nav"
                  onClick={() => SetSidebarOpen(false)}
                >
                  <p className="nav-item sub">User Lock</p>
                </NavLink>
                <NavLink
                  to="/owner-lock"
                  className="nav"
                  onClick={() => SetSidebarOpen(false)}
                >
                  <p className="nav-item sub">Owner Lock</p>
                </NavLink>
              </div>
            )}
          </div> */}

          <NavLink
            to="#"
            className="nav"
            aria-disabled={isLoggingOut}
            onClick={(e) => {
              e.preventDefault();
              handleLogout();
            }}
          >
            <p className="nav-item">
              <i className="bi bi-box-arrow-right"></i>{" "}
              {isLoggingOut ? "Logging out..." : "Logout"}
            </p>
          </NavLink>

          {/* <NavLink
            to="/profile"
            className="nav"
            onClick={() => SetSidebarOpen(false)}
          >
            <p className="nav-item">
              <i class="bi bi-person-fill"></i> Profile
            </p>
          </NavLink> */}
        </div>
      </div>
    </>
  );
};

export default LeftSidebar;
