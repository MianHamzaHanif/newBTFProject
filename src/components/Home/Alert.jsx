import React, { useState } from "react";
import icon21 from "/icon/icon-21.png";
import icon22 from "/icon/icon-22.png";
const Alert = () => {
  const [errMsg, setErrMsg] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  return (
    <>
      {/* Button to open popup */}
      <button className="open-btn" onClick={() => setErrMsg(true)}>
        Show Error Message
      </button>
      <button className="open-btn" onClick={() => setSuccessMsg(true)}>
        Show Success Message
      </button>

      {/* Overlay */}
      {errMsg && (
        <div className="pop-card">
          <button className="close-btn" onClick={() => setErrMsg(false)}>
            ✕
          </button>

          <div className="icon-container">
            <div className="alert-icon">
              <span className="icon">
                <img src={icon21} alt="" />
              </span>
            </div>
          </div>

          <h1 className="welcome-text">
            Welcome, <br />
            <span className="highlight">Username!</span>
          </h1>

          <p className="description">
            Lorem creation was preceded by a long scientific research work
            under.
          </p>

          <button className="confirm-btn">Okay, thanks!</button>

          <div className="bottom-arrow"></div>
        </div>
      )}

      {/* SUCCESS MESSAGE  */}
      {successMsg && (
        <div className="pop-card">
          <button className="close-btn" onClick={() => setSuccessMsg(false)}>
            ✕
          </button>

          <div className="icon-container">
            <div className="alert-icon">
              <span className="icon">
                <img src={icon22} alt="" />
              </span>
            </div>
          </div>

          <h1 className="welcome-text">
            Welcome, <br />
            <span className="highlight">Username!</span>
          </h1>

          <p className="description">
            Lorem creation was preceded by a long scientific research work
            under.
          </p>

          <button className="confirm-btn">Okay, thanks!</button>

          <div className="bottom-arrow"></div>
        </div>
      )}
    </>
  );
};

export default Alert;
