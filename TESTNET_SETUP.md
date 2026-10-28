# BTF Testnet UI

This copied UI now opens a focused BSC Testnet portal. Its entry point is
`src/main.jsx`; the older Mainnet dashboard routes are not mounted. Contract
addresses are in `src/blockchain/testnetDeployment.js` and match
`../testnet-deploy/bsc-testnet-deployment.json`.

Run locally:

```powershell
npm install
npm run dev
```

The wallet must use BSC Testnet (chain 97), hold tBNB for gas, and hold the
deployed test token for package purchases. Register under the displayed root
or another registered testnet sponsor, buy a package, wait for ROI to accrue,
claim, then withdraw once the ledger minimum is reached.

`npm run build` checks the UI bundle. `node verify-testnet-read.cjs` checks
the deployed chain, token, registration gate, Manager history getter and
income lens. Both checks are read only; wallet transactions are initiated
only by a user in the portal.
