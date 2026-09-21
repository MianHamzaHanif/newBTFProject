import { ethers } from "ethers";
import { BSC_TESTNET } from "./bscTestnetConfig.js";
import { ReferralNetworkAddress } from "./address.js";

const registrationABI = [
  "function users(address) view returns (uint256 id, address referral, uint256 registeredAt, uint256 totalTeam, uint256 totalTeamDeposit, uint256 selfDeposit, uint256 totalTeamStakeToken, uint256 selfStakeToken, bool exists)",
  "function rootAddress() view returns (address)",
];

// Wallet providers are used for signing; these reads always target BSC Testnet.
export async function readRegistration(method, ...args) {
  let lastError;
  for (const url of BSC_TESTNET.rpcUrls) {
    const request = new ethers.FetchRequest(url);
    request.timeout = 8000;
    const provider = new ethers.JsonRpcProvider(request, BSC_TESTNET.chainId, {
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
