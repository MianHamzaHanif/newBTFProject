// Run this yourself on your own computer: `node withdrawDirect.cjs`
// It asks for your wallet's private key ONLY in this terminal (nothing is sent
// anywhere else) and signs + broadcasts the withdraw transaction directly,
// skipping MetaMask's own gas-estimation preview that keeps blocking it.
//
// DELETE THIS FILE after you're done. Never commit it, never share it,
// never paste your private key anywhere else.

const { ethers } = require("ethers");
const readline = require("readline");

const PackageManagerABI = require("./src/blockchain/packageMangerABI.json");
const PackageManagerAddress = "0xA3eF4AF3F6A43ef46EA3867f9aCC9fD0539B5483";
const RPC_URL = "https://bsc-dataseed.bnbchain.org";
const GAS_LIMIT = 30000000n;

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

async function main() {
  const privateKey = await ask("Paste your wallet's private key (input is not masked, make sure no one is watching your screen): ");
  if (!privateKey || privateKey.length < 60) {
    console.log("That doesn't look like a valid private key. Aborting.");
    return;
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL, 56, { staticNetwork: true });
  const wallet = new ethers.Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`, provider);
  console.log("Wallet address:", wallet.address);

  const iface = new ethers.Interface(PackageManagerABI);
  const data = iface.encodeFunctionData("withdrawIncome");

  const feeData = await provider.getFeeData();
  console.log("Sending withdraw transaction with a fixed 30,000,000 gas limit...");

  const tx = await wallet.sendTransaction({
    to: PackageManagerAddress,
    data,
    gasLimit: GAS_LIMIT,
    gasPrice: feeData.gasPrice,
  });
  console.log("Sent. Tx hash:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED (reverted on-chain)");
  console.log("Gas used:", receipt.gasUsed.toString());
}

main()
  .catch((e) => console.error("Error:", e.shortMessage || e.reason || e.message))
  .finally(() => process.exit(0));
