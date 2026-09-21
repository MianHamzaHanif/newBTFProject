import React, { useEffect, useState } from "react";
import logo from "/dashboardimg/logo.png";
import coinImage from "/dashboardimg/coin-img.png";
import { ethers } from "ethers";
import RouterABI from "../blockchain/routerABI";
import {
  RouterAddress,
  StakeTokenAddress,
  TokenAddress,
} from "../blockchain/address";
import { createBscReadProvider } from "../blockchain/readProvider";

const RightSidebar = () => {
  const [tokenPrice, setTokenPrice] = useState("--");
  const [usdtPrice, setUsdtPrice] = useState("--");

  const formatEther4 = (value) => {
    try {
      const etherValue = ethers.formatEther(value ?? 0n);
      const [whole, fraction = ""] = etherValue.split(".");
      return `${whole}.${(fraction + "0000").slice(0, 4)}`;
    } catch {
      return "0.0000";
    }
  };

  useEffect(() => {
    const loadTokenPrice = async () => {
      try {
        const provider = createBscReadProvider();
        const router = new ethers.Contract(RouterAddress, RouterABI, provider);

        const oneToken = ethers.parseEther("1");
        const [tokenOut, usdtOut] = await Promise.all([
          router.getAmountsOut(oneToken, [TokenAddress, StakeTokenAddress]),
          router.getAmountsOut(oneToken, [StakeTokenAddress, TokenAddress]),
        ]);

        const tokenPriceValue = formatEther4(tokenOut?.[1] ?? 0n);
        const usdtPriceValue = formatEther4(usdtOut?.[1] ?? 0n);

        setTokenPrice(tokenPriceValue);
        setUsdtPrice(usdtPriceValue);
      } catch {
        setTokenPrice("Price unavailable");
        setUsdtPrice("Price unavailable");
      }
    };

    loadTokenPrice();
  }, []);

  return (
    <div className="right-sidebar-wrapper">
      <div className="right-sidebar-content">
        {/* glowing flow layers */}
        <div className="bg-wave wave-1"></div>
        <div className="bg-wave wave-2"></div>

        {/* glow behind coin */}
        <div className="coin-glow"></div>

        {/* right green line */}
        <div classNamse="right-line"></div>

        {/* CONTENT */}
        <div className="right-content">
          <div className="right-top-content">
            <div className="logo">
              <img src={logo} alt="" />
            </div>
            {/* <h2>LOGOTYPE</h2> */}
            <div className="language">
              <div className="hexgon-border">
                <span>En</span>
              </div>
              <div className="hexgon-border">
                <span>Sp</span>
              </div>
              <div className="hexgon-border">
                <span>Fr</span>
              </div>
            </div>
          </div>

          <div className="right-bottom-content">
            {/* <p className="title">
              Soon our Token <br />
              on PancakeSwap
            </p> */}

            <div className="coin-image">
              <img src={coinImage} alt="" />
            </div>

            {/* <div className="price-box">
              <p className="price-title">Token Price</p>
              <span className="price">{tokenPrice}</span>
              <p className="price-title">USDT Price</p>
              <span className="price">{usdtPrice}</span>
            </div> */}

            <button className="btn">
              {/* <span className="mainText">Buy Token Now</span> */}
              <span className="subText">COMING SOON</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RightSidebar;
