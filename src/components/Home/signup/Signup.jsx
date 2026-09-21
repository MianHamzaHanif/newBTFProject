import React, { useState } from "react";
import image from "/dashboardimg/logo.png";
import "./signup.css";
import { Link, Links } from "react-router-dom";

const Signup = () => {
  const [registerPopOpen, setRegisterPopOpen] = useState(false);
  return (
    <div className="signup-wrapper">
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
        <div className="signup-card">
          <h1>Access To Your Personal Account</h1>
          <button onClick={() => setRegisterPopOpen(true)}>Register </button>

          {registerPopOpen && (
            <div className="modal-overlay">
              <div className="modal-box">
                {/* Close Button */}
                <span
                  className="close-btn"
                  onClick={() => setRegisterPopOpen(false)}
                >
                  ×
                </span>

                <h3>Register</h3>

                <input type="text" placeholder="Enter User ID" />

                <button className="submit-btn">Register Now</button>
              </div>
            </div>
          )}

          {/* <p>To continue, please Signup with your Personal Info.</p> */}
          <div className="form-grid">
            <span className="signup-text">
              Remember to authorize with the correct address. View an Account
            </span>
            <input placeholder="Enter Id or Wallet Address" />

            {/* <div className="login-input custom-input">
              <span
                className="icon"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <i class="bi bi-eye"></i>
                ) : (
                  <i class="bi bi-eye-slash"></i>
                )}
              </span>
              <input
                type={showPassword ? "password" : "text"}
                placeholder="Password"
              />
            </div> */}

            {/* <div className="login-input custom-input">
              <span
                className="icon"
                onClick={() => setConfirmShowPassword(!confirmShowPassword)}
              >
                {confirmShowPassword ? (
                  <i class="bi bi-eye"></i>
                ) : (
                  <i class="bi bi-eye-slash"></i>
                )}
              </span>
              <input
                type={confirmShowPassword ? "password" : "text"}
                placeholder="Confirm Password"
              />
            </div> */}

            {/* <input type="password" placeholder="Password" /> */}
            {/* <input type="password" placeholder="Confirm Password" /> */}
          </div>
          <button>Connect to Wallet </button>
          <p className="login-text">
            Already have an account, please{" "}
            <Link to={"/login"} className="link">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
