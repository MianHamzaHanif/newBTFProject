import React from "react";
import "./Footer.css";
const Footer = () => {
  return (
    <div className="dashboard-footer-wrapper">
      <div className="icon-wrapper">
        <div className="hexagon">
          <div className="hexagon-outer">
            <div className="hexagon-inner">
              <div className="content">
                <span className="icon">
                  <i className="bi bi-send"></i>
                </span>
              </div>
            </div>
          </div>
          <p>
            Telegram <br /> Group
          </p>
        </div>

        <div className="hexagon">
          <div className="hexagon-outer">
            <div className="hexagon-inner">
              <div className="content">
                <span className="icon">
                  <i className="bi bi-send"></i>
                </span>
              </div>
            </div>
          </div>
          <p>
            Telegram <br /> Chart
          </p>
        </div>

        <div className="hexagon">
          <div className="hexagon-outer">
            <div className="hexagon-inner">
              <div className="content">
                <span className="icon">
                  <i className="bi bi-send"></i>
                </span>
              </div>
            </div>
          </div>
          <p>
            Telegram <br /> Support
          </p>
        </div>
      </div>
      <div className="copyright">
        <p>&copy; 2026 All Right Reserved</p>
      </div>
    </div>
  );
};

export default Footer;
