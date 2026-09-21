import { useState } from "react";

const TransactionPassword = () => {
  const [currentPass, setCurrentTransPass] = useState(false);
  const [newTransPass, setNewTransPass] = useState(false);
  const [confirmNewTransPass, setConfirmNewTransPass] = useState(false);
  return (
    <div className="profile-info-show">
      <h1 className="title">Change Your Transaction Password</h1>

      <div className="info-container">
        {/* Current Transaction Password */}
        <div className="info-tab  custom-input">
          <span
            className="icon"
            onClick={() => setCurrentTransPass(!currentPass)}
          >
            {currentPass ? (
              <i class="bi bi-eye"></i>
            ) : (
              <i class="bi bi-eye-slash"></i>
            )}
          </span>
          <input
            type={currentPass ? "password" : "text"}
            placeholder="Current Transaction Password"
          />{" "}
        </div>

        {/* New Transaction Password */}
        <div className="info-tab  custom-input">
          <span className="icon" onClick={() => setNewTransPass(!newTransPass)}>
            {newTransPass ? (
              <i class="bi bi-eye"></i>
            ) : (
              <i class="bi bi-eye-slash"></i>
            )}
          </span>
          <input
            type={newTransPass ? "password" : "text"}
            placeholder="New Transaction Password"
          />{" "}
        </div>

        {/* Confirm Transaction Password */}
        <div className="info-tab  custom-input">
          <span
            className="icon"
            onClick={() => setConfirmNewTransPass(!confirmNewTransPass)}
          >
            {confirmNewTransPass ? (
              <i class="bi bi-eye"></i>
            ) : (
              <i class="bi bi-eye-slash"></i>
            )}
          </span>
          <input
            type={confirmNewTransPass ? "password" : "text"}
            placeholder="Confrim New Transaction Password"
          />{" "}
        </div>

        {/* Button */}
        <button className="btn">Change Transaction Password</button>
      </div>
    </div>
  );
};

export default TransactionPassword;
