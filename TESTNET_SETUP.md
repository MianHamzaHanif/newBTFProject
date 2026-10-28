# BTF Testnet UI

This copied UI keeps its original pages and layout. Contract addresses are in
`src/blockchain/address.js`; its wallet and read network is BSC Testnet
(chain 97) in `src/blockchain/bscMainnetConfig.js`.

Run locally:

```powershell
npm install
npm run dev
```

The wallet must use BSC Testnet (chain 97), hold tBNB for gas, and hold the
deployed test token for package purchases. Register under the on-chain root
or a registered sponsor. Buy from the Dashboard, claim from Claim V2 Income
after ROI accrues, then use Withdraw V2 when the ledger minimum is reached.

`npm run build` checks the original UI bundle. `node verify-testnet-read.cjs` checks
the deployed chain, token, registration gate, Manager history getter and
income lens. Both checks are read only; wallet transactions are initiated
only by a user in the UI.
