// Legacy V2's withdrawal getter predates the V3 gross/fee/net structure.
// Its two return values are exactly `(amount, timestamp)`.
export default [
  "function getUserIncomeHistoryLength(address user) view returns (uint256)",
  "function getUserIncomeHistoryAt(address user,uint256 index) view returns (uint8 incomeType,uint8 level,uint256 amount,uint256 timestamp)",
  "function getUserWithdrawHistoryLength(address user) view returns (uint256)",
  "function getUserWithdrawHistoryAt(address user,uint256 index) view returns (uint256 amount,uint256 timestamp)",
];
