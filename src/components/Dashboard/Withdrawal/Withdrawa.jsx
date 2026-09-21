import React from "react";
import V2Withdrawal from "./V2Withdrawal";
import "../styles/style.css";

export const Withdrawal = () => (
  <div className="page-container">
    {/* Old Withdrawal Overview is intentionally disabled for V2. */}
    <V2Withdrawal />
  </div>
);

export default Withdrawal;
