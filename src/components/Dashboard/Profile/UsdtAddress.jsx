import { useEffect, useState } from "react";

const UsdtAddress = () => {
  const [transPass, setTransPass] = useState(false);
  return (
    <div className="profile-info-show">
      <h1 className="title">Your USDT Address</h1>

      <div className="info-container">
        {/* USDT Address */}
        <div className="info-tab ">
          <input placeholder="E-currency Address (BEP-20)" />{" "}
        </div>

        {/* Transaction Password */}
        <div className="info-tab  custom-input">
          <span className="icon" onClick={() => setTransPass(!transPass)}>
            {transPass ? (
              <i class="bi bi-eye"></i>
            ) : (
              <i class="bi bi-eye-slash"></i>
            )}
          </span>
          <input
            type={transPass ? "password" : "text"}
            placeholder=" Transaction Password"
          />{" "}
        </div>

        {/* Button */}
        <button className="btn">Update Wallet Address</button>
      </div>
    </div>
  );
};

export default UsdtAddress;
