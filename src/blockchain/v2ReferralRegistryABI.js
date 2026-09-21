export default [
  "function users(address user) view returns (uint256 id,address referral,uint256 registeredAt,uint256 totalTeam,uint256 totalTeamDeposit,uint256 selfDeposit,uint256 totalTeamStakeToken,uint256 selfStakeToken,bool exists)",
  "function isLevelOpen(address user,uint256 level) view returns (bool)",
  "function getAchievedRewardCount(address user) view returns (uint256)",
  "function getAchievedPowerLevel(address user) view returns (uint256)",
  "function powerAchievedAt(address user,uint256 level) view returns (uint256)",
  "function powerQualifiedBusiness(address user,uint256 level) view returns (uint256)",
  "function powerThreshold(uint256 level) view returns (uint256)",
  "function rewardQualifiedBusiness(address user,uint256 index) view returns (uint256)",
  "function rewardThreshold(uint256 index) view returns (uint256)",
  "function rewardAchievedAt(address user,uint256 index) view returns (uint256)",
  "function getLevelUsersLength(address upline,uint256 level) view returns (uint256)",
  "function getLevelUserAt(address upline,uint256 level,uint256 index) view returns (address)",
  "function legBusiness(address upline,address direct) view returns (uint256)",
  "function hasQualifiedPackage(address user) view returns (bool)"
];
