export default [
  "function balanceOf(address user) view returns (uint256)",
  "function minWithdrawAmount() view returns (uint256)",
  "function setMinWithdrawAmount(uint256 newAmount)",
  "function withdrawAll() returns (uint256 amount)",
  "function getUserIncomeHistoryLength(address user) view returns (uint256)",
  "function getUserIncomeHistoryAt(address user,uint256 index) view returns (uint8 incomeType,uint8 level,uint256 amount,uint256 timestamp)",
  "function getUserIncomeHistoryLengthByType(address user,uint8 incomeType) view returns (uint256)",
  "function getUserIncomeHistoryAtByType(address user,uint8 incomeType,uint256 index) view returns (uint8 level,uint256 amount,uint256 timestamp)",
  "function getUserWithdrawHistoryLength(address user) view returns (uint256)",
  "function getUserWithdrawHistoryAt(address user,uint256 index) view returns (uint256 amount,uint256 timestamp)"
];
