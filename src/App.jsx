import React, { useEffect } from "react";
import "bootstrap-icons/font/bootstrap-icons.css";

import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "./layout/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import {
  Activation,
  ActivationHistory,
  Tree,
  Income1,
  Income2,
  Income3,
  Income4,
  Income5,
  Income6,
  PowerIncomeWithdraw,
  FlushIncome,
  Lock,
  OwnerLock,
  MyDirect,
  MyTeam,
  Withdrawal,
  WithdrawalHistory,
} from "./pages";
import Home from "./pages/Home";
import Login from "./components/Home/Login/Login";
import Signup from "./components/Home/signup/Signup";
import ForgotPassword from "./components/Home/ForgotPassword/ForgotPassword";
import WelcomePage from "./components/Home/WelcomePage/WelcomePage";
import Alert from "./components/Home/Alert";
import Profile from "./components/Dashboard/Profile/Proflie";
import V2ClaimHistory from "./components/Dashboard/Income/V2ClaimHistory";
import V2ClaimIncome from "./components/Dashboard/Income/V2ClaimIncome";
import RequireV2Registration from "./components/Auth/RequireV2Registration";
const App = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.ethereum) {
      return;
    }

    const handleAccountsChanged = (accounts) => {
      const path = window.location.pathname.toLowerCase();
      const dashboardPaths = [
        "/dashboard",
        "/activation",
        "/tree",
        "/activation-history",
        "/team/my-team",
        "/my-direct",
        "/income/",
        "/withdrawal",
        "/withdrawal-history",
        "/lock",
        "/owner-lock",
        "/profile",
      ];

      const shouldReload = dashboardPaths.some((p) =>
        p.endsWith("/") ? path.startsWith(p) : path === p,
      );

      const nextAccount = accounts?.[0] || "";

      if (!nextAccount) {
        navigate("/login", { replace: true });
        return;
      }

      if (shouldReload) {
        // Recheck registration for the newly selected wallet.
        navigate("/login", { replace: true });
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, [navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const redirect = params.get("redirect");
    const ref = params.get("ref");

    if (
      location.pathname === "/" &&
      redirect &&
      !location.hash &&
      redirect.trim().length > 0
    ) {
      navigate(redirect, { replace: true });
      return;
    }

    if (
      location.pathname === "/" &&
      ref &&
      !location.hash &&
      ref.trim().length > 0
    ) {
      navigate(`/login?ref=${encodeURIComponent(ref)}`, { replace: true });
    }
  }, [location.hash, location.pathname, location.search, navigate]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/welcomePage" element={<WelcomePage />} />
      <Route path="/alert" element={<Alert />} />
      <Route element={<RequireV2Registration />}>
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/activation" element={<Activation />} />
        <Route path="/tree" element={<Tree />} />
        <Route path="/activation-history" element={<ActivationHistory />} />
        <Route path="/team/my-team" element={<MyTeam />} />
        <Route path="/my-direct" element={<MyDirect />} />
        <Route path="/income/income-1" element={<Income1 />} />
        <Route path="/income/income-2" element={<Income2 />} />
        <Route path="/income/income-3" element={<Income3 />} />
        <Route path="/income/income-4" element={<Income4 />} />
        <Route path="/income/income-5" element={<Income5 />} />
        <Route path="/income/income-6" element={<Income6 />} />
        <Route path="/income/power-income-withdraw" element={<PowerIncomeWithdraw />} />
        <Route path="/income/flush-income" element={<FlushIncome />} />
        <Route path="/income/v2-claim-history" element={<V2ClaimHistory />} />
        <Route path="/income/v2-claim" element={<V2ClaimIncome />} />
        <Route path="/withdrawal" element={<Withdrawal />} />
        <Route path="/withdrawal-history" element={<WithdrawalHistory />} />
        <Route path="/lock" element={<Lock />} />
        <Route path="/owner-lock" element={<OwnerLock />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      </Route>
    </Routes>
  );
};

export default App;
