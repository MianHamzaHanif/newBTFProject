import { useState } from "react";

const ChangePassword = () => {
  const [currPass, setCurrPass] = useState(false);
  const [newPass, setNewPass] = useState(false);
  const [conNewPass, setConNewPass] = useState(false);
  return (
    <div className="profile-info-show">
      <h1 className="title">Change Your Password</h1>

      <div className="info-container">
        {/* Current Password */}
        <div className="info-tab  custom-input">
          <span className="icon" onClick={() => setCurrPass(!currPass)}>
            {currPass ? (
              <i class="bi bi-eye"></i>
            ) : (
              <i class="bi bi-eye-slash"></i>
            )}
          </span>
          <input
            type={currPass ? "password" : "text"}
            placeholder="Current  Password"
          />{" "}
        </div>

        {/* New Password */}
        <div className="info-tab  custom-input">
          <span className="icon" onClick={() => setNewPass(!newPass)}>
            {newPass ? (
              <i class="bi bi-eye"></i>
            ) : (
              <i class="bi bi-eye-slash"></i>
            )}
          </span>
          <input
            type={newPass ? "password" : "text"}
            placeholder="New Password"
          />{" "}
        </div>

        {/* Confirm Password */}
        <div className="info-tab  custom-input">
          <span className="icon" onClick={() => setConNewPass(!conNewPass)}>
            {conNewPass ? (
              <i class="bi bi-eye"></i>
            ) : (
              <i class="bi bi-eye-slash"></i>
            )}
          </span>
          <input
            type={conNewPass ? "password" : "text"}
            placeholder="Confirm New Password"
          />{" "}
        </div>

        {/* Button */}
        <button className="btn">Change Password</button>
      </div>
    </div>
  );
};

export default ChangePassword;
