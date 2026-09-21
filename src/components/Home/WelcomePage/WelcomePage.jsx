import React from "react";
import image from "/dashboardimg/logo.png";
import "./WelcomePage.css";
import { Link, Links } from "react-router-dom";

const WelcomePage = () => {
  return (
    <div className="welcome-wrapper">
      <div className="crypto-bg">
        <div className="bg-waves"></div>

        {/* Left Arrow */}
        <div className="arrow arrow-left"></div>

        {/* Right Arrow */}
        <div className="arrow arrow-right"></div>

        {/* Your card / content */}
        <div className="login-header">
          <div className="back">
            <Link to={"/"} className="link">
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
        <div className="welcome-card">
          <h1>WELCOME LETTER</h1>
          <p>
            WELCOME TO FX SPACE <br />
          </p>
          <p>TO,</p>
          <p className="description">
            THANK YOU FOR THE REGISTRATION WITH FX SPACE. YOUR CORDIAL <br />
            ASSOCIATION IS WELCOME IN THE BUSINESS FAMILY. <br />
            WISH YOU BRIGHT FUTURE FOR GROWTH !
          </p>
          <div className="welcome-grid">
            <div className="welcome-info">
              <label htmlFor="">Name :</label>
              <p>Najeeb</p>
            </div>
            <div className="welcome-info">
              <label htmlFor="">USER :</label>
              <p>XIXIXI</p>
            </div>
            <div className="welcome-info">
              <label htmlFor="">EMAIL :</label>
              <p>XIXIXIXIXIX</p>
            </div>
            <div className="welcome-info">
              <label htmlFor="">MOBILE :</label>
              <p>XIXIXIXIXI</p>
            </div>
          </div>
          <Link to={"/login"} className="login-btn">LOGIN</Link>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
