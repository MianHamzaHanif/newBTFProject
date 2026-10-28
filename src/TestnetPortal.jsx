import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { TESTNET_ADDRESSES as A, TESTNET_CHAIN_ID, TESTNET_NETWORK } from "./blockchain/testnetDeployment";
import "./TestnetPortal.css";

const registryAbi = [
  "function rootAddress() view returns (address)",
  "function users(address) view returns (uint256 id,address referral,uint256 registeredAt,uint256 totalTeam,uint256 totalTeamDeposit,uint256 selfDeposit,uint256 totalTeamStakeToken,uint256 selfStakeToken,bool exists)",
  "function register(address referral)",
];
const managerAbi = [
  "function buyPackage(uint256)",
  "function claimSelfRoi() returns (uint256)",
  "function claimLevelRoi() returns (uint256)",
  "function claimDirectIncome() returns (uint256)",
  "function claimPowerIncome() returns (uint256)",
  "function claimRewardIncome() returns (uint256)",
  "function totalIncomeLimit(address) view returns (uint256)",
  "function totalIncomeUsed(address) view returns (uint256)",
  "function getPackageHistoryLength(address) view returns (uint256)",
  "function packageHistory(address,uint256) view returns (uint256 amount,uint256 purchasedAt,uint256 deactivatedAt,uint256 selfRoiMaximum)",
];
const lensAbi = ["function getIncomeReady(address,uint8) view returns (uint256)"];
const ledgerAbi = [
  "function balanceOf(address) view returns (uint256)",
  "function minWithdrawAmount() view returns (uint256)",
  "function withdrawAll() returns (uint256)",
  "function getUserWithdrawHistoryLength(address) view returns (uint256)",
  "function getUserWithdrawHistoryAt(address,uint256) view returns (uint256 grossAmount,uint256 feeAmount,uint256 netAmount,uint256 timestamp)",
];
const tokenAbi = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];
const claimKinds = [
  ["Self ROI", "claimSelfRoi", 1],
  ["Level ROI", "claimLevelRoi", 2],
  ["Direct Income", "claimDirectIncome", 0],
  ["Power Income", "claimPowerIncome", 3],
  ["Reward Income", "claimRewardIncome", 4],
];
const fmt = (value, decimals = 18) => Number(ethers.formatUnits(value ?? 0n, decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 });
const short = (value) => value ? `${value.slice(0, 7)}…${value.slice(-5)}` : "";

export default function TestnetPortal() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(0);
  const [root, setRoot] = useState("");
  const [referral, setReferral] = useState("");
  const [registered, setRegistered] = useState(false);
  const [userId, setUserId] = useState(0n);
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [tokenBalance, setTokenBalance] = useState(0n);
  const [ledgerBalance, setLedgerBalance] = useState(0n);
  const [incomeLimit, setIncomeLimit] = useState(0n);
  const [incomeUsed, setIncomeUsed] = useState(0n);
  const [minWithdraw, setMinWithdraw] = useState(0n);
  const [ready, setReady] = useState({});
  const [packages, setPackages] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [packageValue, setPackageValue] = useState("25");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const getReadProvider = useCallback(() => new ethers.JsonRpcProvider(TESTNET_NETWORK.rpcUrls[0], TESTNET_CHAIN_ID, { staticNetwork: true }), []);
  const refresh = useCallback(async (wallet = account) => {
    if (!wallet) return;
    const provider = getReadProvider();
    try {
      const reg = new ethers.Contract(A.registry, registryAbi, provider);
      const mgr = new ethers.Contract(A.manager, managerAbi, provider);
      const led = new ethers.Contract(A.ledger, ledgerAbi, provider);
      const lens = new ethers.Contract(A.incomeReadyLens, lensAbi, provider);
      const tok = new ethers.Contract(A.token, tokenAbi, provider);
      const [rootAddress, user, decimals, balance, credit, limit, used, minimum, packageLength, withdrawalLength] = await Promise.all([
        reg.rootAddress(), reg.users(wallet), tok.decimals(), tok.balanceOf(wallet), led.balanceOf(wallet),
        mgr.totalIncomeLimit(wallet), mgr.totalIncomeUsed(wallet), led.minWithdrawAmount(),
        mgr.getPackageHistoryLength(wallet), led.getUserWithdrawHistoryLength(wallet),
      ]);
      const packageRows = await Promise.all(Array.from({ length: Math.min(Number(packageLength), 30) }, (_, i) => mgr.packageHistory(wallet, BigInt(packageLength) - 1n - BigInt(i))));
      const withdrawalRows = await Promise.all(Array.from({ length: Math.min(Number(withdrawalLength), 30) }, (_, i) => led.getUserWithdrawHistoryAt(wallet, BigInt(withdrawalLength) - 1n - BigInt(i))));
      const incomeRows = await Promise.all(claimKinds.map(async ([, , type]) => {
        try { return await lens.getIncomeReady(wallet, type); } catch { return 0n; }
      }));
      setRoot(rootAddress); setReferral((old) => old || rootAddress);
      setRegistered(Boolean(user.exists)); setUserId(user.id);
      setTokenDecimals(Number(decimals)); setTokenBalance(balance); setLedgerBalance(credit);
      setIncomeLimit(limit); setIncomeUsed(used); setMinWithdraw(minimum);
      setPackages(packageRows); setWithdrawals(withdrawalRows);
      setReady(Object.fromEntries(claimKinds.map(([, , type], i) => [type, incomeRows[i]])));
      setError("");
    } finally { provider.destroy(); }
  }, [account, getReadProvider]);

  useEffect(() => {
    if (!window.ethereum) return;
    const sync = async () => {
      const [accounts, currentChain] = await Promise.all([
        window.ethereum.request({ method: "eth_accounts" }),
        window.ethereum.request({ method: "eth_chainId" }),
      ]);
      setAccount(accounts?.[0] || ""); setChainId(Number(BigInt(currentChain)));
    };
    sync().catch((e) => setError(e.message));
    window.ethereum.on?.("accountsChanged", sync);
    window.ethereum.on?.("chainChanged", sync);
    return () => { window.ethereum.removeListener?.("accountsChanged", sync); window.ethereum.removeListener?.("chainChanged", sync); };
  }, []);
  useEffect(() => { if (account && chainId === TESTNET_CHAIN_ID) refresh(account).catch((e) => setError(e.shortMessage || e.message)); }, [account, chainId, refresh]);

  const switchNetwork = async () => {
    if (!window.ethereum) throw new Error("Wallet extension required");
    try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: TESTNET_NETWORK.chainId }] }); }
    catch (e) {
      if (e.code !== 4902) throw e;
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [TESTNET_NETWORK] });
    }
    const actual = await window.ethereum.request({ method: "eth_chainId" });
    if (Number(BigInt(actual)) !== TESTNET_CHAIN_ID) throw new Error("Select BSC Testnet in your wallet");
    setChainId(TESTNET_CHAIN_ID);
  };
  const connect = async () => {
    try {
      if (!window.ethereum) throw new Error("Install a wallet such as MetaMask");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      await switchNetwork(); setAccount(accounts[0] || ""); setError("");
    } catch (e) { setError(e.shortMessage || e.message); }
  };
  const transact = async (label, action) => {
    setBusy(label); setError(""); setNotice("");
    try {
      await switchNetwork();
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      if ((await signer.getAddress()).toLowerCase() !== account.toLowerCase()) throw new Error("Wallet account changed; reconnect");
      await action(signer);
      setNotice(`${label} confirmed on BSC Testnet`);
      await refresh(account);
    } catch (e) { setError(e.shortMessage || e.reason || e.message); }
    finally { setBusy(""); }
  };
  const register = () => transact("Registration", async (signer) => {
    if (!ethers.isAddress(referral) || referral.toLowerCase() === account.toLowerCase()) throw new Error("Enter a valid sponsor address");
    const reg = new ethers.Contract(A.registry, registryAbi, signer);
    if (!(await reg.users(referral)).exists) throw new Error("Sponsor is not registered on this testnet deployment");
    await (await reg.register(referral)).wait();
  });
  const buy = () => transact("Package purchase", async (signer) => {
    const amount = ethers.parseUnits(packageValue, 18);
    const token = new ethers.Contract(A.token, tokenAbi, signer);
    if (await token.balanceOf(account) < amount) throw new Error("Insufficient test token balance");
    if (await token.allowance(account, A.manager) < amount) await (await token.approve(A.manager, amount)).wait();
    await (await new ethers.Contract(A.manager, managerAbi, signer).buyPackage(amount)).wait();
  });
  const claim = (method, label) => transact(label, async (signer) => {
    await (await new ethers.Contract(A.manager, managerAbi, signer)[method]()).wait();
  });
  const withdraw = () => transact("Withdrawal", async (signer) => {
    if (ledgerBalance < minWithdraw) throw new Error(`Minimum withdrawal is ${fmt(minWithdraw)} tokens`);
    await (await new ethers.Contract(A.ledger, ledgerAbi, signer).withdrawAll()).wait();
  });

  return <main className="testnet-portal">
    <header className="tp-header"><div><span className="tp-kicker">BTF · DEVELOPMENT ENVIRONMENT</span><h1>BSC Testnet Portal</h1><p>New-user registration, packages, income claims and withdrawals.</p></div><div className="tp-wallet"><span className="tp-badge">Chain 97 · Testnet</span><button onClick={connect}>{account ? short(account) : "Connect wallet"}</button></div></header>
    {chainId !== 0 && chainId !== TESTNET_CHAIN_ID && <div className="tp-alert">Wallet is on chain {chainId}. <button onClick={() => switchNetwork().catch((e) => setError(e.message))}>Switch to BSC Testnet</button></div>}
    {error && <div className="tp-error" role="alert">{error}</div>}{notice && <div className="tp-success" role="status">{notice}</div>}
    {!account ? <section className="tp-panel"><h2>Connect your test wallet</h2><p>Your wallet must have tBNB for gas and test tokens for a package purchase.</p><button onClick={connect}>Connect wallet</button></section> : chainId !== TESTNET_CHAIN_ID ? null : <>
      <div className="tp-stats"><div><span>User ID</span><strong>{registered ? userId.toString() : "Not registered"}</strong></div><div><span>Token balance</span><strong>{fmt(tokenBalance, tokenDecimals)}</strong></div><div><span>Income limit / used</span><strong>{fmt(incomeLimit)} / {fmt(incomeUsed)}</strong></div><div><span>Available to withdraw</span><strong>{fmt(ledgerBalance)}</strong></div></div>
      <div className="tp-grid"><section className="tp-panel"><span className="tp-step">01</span><h2>Register</h2><p>Root sponsor: <code>{root || "Loading…"}</code></p><label>Sponsor wallet<input value={referral} onChange={(e) => setReferral(e.target.value)} disabled={registered || Boolean(busy)} /></label><button disabled={registered || Boolean(busy)} onClick={register}>{registered ? "Registered" : "Register"}</button></section>
      <section className="tp-panel"><span className="tp-step">02</span><h2>Buy package</h2><p>Approval and purchase each require a wallet confirmation.</p><label>Package value<select value={packageValue} onChange={(e) => setPackageValue(e.target.value)}><option>25</option><option>100</option><option>500</option><option>1000</option></select></label><button disabled={!registered || Boolean(busy)} onClick={buy}>Approve & buy</button></section>
      <section className="tp-panel"><span className="tp-step">03</span><h2>Claim income</h2><p>ROI accrues with contract time. A new purchase has no immediate Self ROI.</p><div className="tp-claims">{claimKinds.map(([label, method, type]) => <div key={method}><span>{label}<small>{fmt(ready[type])} ready</small></span><button disabled={!registered || Boolean(busy) || !ready[type]} onClick={() => claim(method, label)}>Claim</button></div>)}</div></section>
      <section className="tp-panel"><span className="tp-step">04</span><h2>Withdraw</h2><p>Ledger balance: {fmt(ledgerBalance)} · Minimum: {fmt(minWithdraw)}</p><p>The contract sends 93% net to your wallet and 7% as a fee.</p><button disabled={Boolean(busy) || ledgerBalance < minWithdraw} onClick={withdraw}>Withdraw all</button></section></div>
      <div className="tp-grid tp-history"><section className="tp-panel"><h2>Package history</h2>{packages.length ? packages.map((p, i) => <div className="tp-row" key={i}><span>{fmt(p.amount)} tokens · {p.deactivatedAt === 0n ? "Active" : "Inactive"}</span><time>{new Date(Number(p.purchasedAt) * 1000).toLocaleString()}</time></div>) : <p>No packages yet.</p>}</section><section className="tp-panel"><h2>Withdrawal history</h2>{withdrawals.length ? withdrawals.map((w, i) => <div className="tp-row" key={i}><span>Gross {fmt(w.grossAmount)} · Fee {fmt(w.feeAmount)} · Net {fmt(w.netAmount)}</span><time>{new Date(Number(w.timestamp) * 1000).toLocaleString()}</time></div>) : <p>No withdrawals yet.</p>}</section></div>
      <div className="tp-footer"><button className="tp-secondary" disabled={Boolean(busy)} onClick={() => refresh().catch((e) => setError(e.message))}>Refresh balances</button>{busy && <span>Waiting for {busy.toLowerCase()} confirmation…</span>}<span>Testnet token: <code>{A.token}</code></span></div>
    </>}
  </main>;
}
