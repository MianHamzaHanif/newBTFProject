import { ethers } from "ethers";
import { BSC_MAINNET } from "./bscMainnetConfig.js";
import { ReferralNetworkAddress } from "./address.js";
import { V1_MAINNET } from "./v1MainnetConfig.js";

const registrationABI = [
  "function users(address) view returns (uint256 id, address referral, uint256 registeredAt, uint256 totalTeam, uint256 totalTeamDeposit, uint256 selfDeposit, uint256 totalTeamStakeToken, uint256 selfStakeToken, bool exists)",
  "function rootAddress() view returns (address)",
];

// Wallet providers are used for signing; these reads always target BSC Mainnet.
export async function readRegistration(method, ...args) {
  let lastError;
  for (const url of BSC_MAINNET.rpcUrls) {
    const request = new ethers.FetchRequest(url);
    request.timeout = 8000;
    const provider = new ethers.JsonRpcProvider(request, BSC_MAINNET.chainId, {
      staticNetwork: true,
      batchMaxCount: 1,
    });
    try {
      const contract = new ethers.Contract(ReferralNetworkAddress, registrationABI, provider);
      return await contract[method](...args);
    } catch (error) {
      lastError = error;
    } finally {
      provider.destroy();
    }
  }
  throw new Error("Unable to check registration on BSC. Click your wallet address to retry.", { cause: lastError });
}

// V1 remains a valid dashboard data source during migration. Keep its
// registration read separate from V2 so a V1-only member can enter and see
// their historical data before their V2 structure/package import is done.
export async function readV1Registration(method, ...args) {
  const request = new ethers.FetchRequest(V1_MAINNET.rpcUrl);
  request.timeout = 8000;
  const provider = new ethers.JsonRpcProvider(request, V1_MAINNET.chainId, {
    staticNetwork: true,
    batchMaxCount: 1,
  });
  try {
    const contract = new ethers.Contract(V1_MAINNET.referralNetwork, registrationABI, provider);
    return await contract[method](...args);
  } finally {
    provider.destroy();
  }
}
