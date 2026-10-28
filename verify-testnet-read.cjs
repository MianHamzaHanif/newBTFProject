const { ethers } = require("ethers");

const addresses = {
  token: "0xb602A2B700ba8bF788F06cC461EC8Fb1635e244D",
  registry: "0x81482D09896d43f171B54Adf0dd48FD7eEE23411",
  manager: "0x7f885a268CEE82bFd4922F05326eF1B2475Ed8c0",
  lens: "0x692a2258A3d1e4077AC5B02baeE21B69Bd1A0e46",
};

async function main() {
  const provider = new ethers.JsonRpcProvider("https://bsc-testnet-rpc.publicnode.com", 97);
  try {
    const token = new ethers.Contract(addresses.token, ["function decimals() view returns (uint8)"], provider);
    const registry = new ethers.Contract(addresses.registry, ["function rootAddress() view returns (address)", "function registrationMigrationComplete() view returns (bool)"], provider);
    const manager = new ethers.Contract(addresses.manager, ["function getPackageHistoryLength(address) view returns (uint256)"], provider);
    const lens = new ethers.Contract(addresses.lens, ["function getIncomeReady(address,uint8) view returns (uint256)"], provider);
    const root = await registry.rootAddress();
    console.log(JSON.stringify({
      chainId: Number((await provider.getNetwork()).chainId),
      decimals: Number(await token.decimals()),
      root,
      registrationReady: await registry.registrationMigrationComplete(),
      packageHistoryLength: String(await manager.getPackageHistoryLength(root)),
      selfReady: String(await lens.getIncomeReady(root, 1)),
    }, null, 2));
  } finally { provider.destroy(); }
}
main().catch((error) => { console.error(error.shortMessage || error.message); process.exitCode = 1; });
