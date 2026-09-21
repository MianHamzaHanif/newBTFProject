import React from "react";
import image from "/dashboardimg/logo.png";
import "./forgot.css";
import { Link } from "react-router-dom";

const ForgotPassword = () => {
  return (
    <div className="forgot-wrapper">
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
        <div className="forgot-card">
          <h1>Forgot Your Account Password</h1>
          <p>To continue, please log in with your email and password</p>
          <div className="form-grid">
            <input
              placeholder="Your Registered Email"
              style={{ width: "100%" }}
            />
          </div>
          <button>Forgot Password</button>
          <p className="signup-text">
            Don't have an account, please{" "}
            <Link to={"/login"} className="link">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
