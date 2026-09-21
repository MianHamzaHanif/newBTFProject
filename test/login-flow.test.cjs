const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('@swc/core');
const { ethers } = require('ethers');

const registered = '0xa4C18E35feaF3bbFCf3781D15B3281AcA7f40d43';
const newcomer = '0x0000000000000000000000000000000000000123';
const code = transformSync(fs.readFileSync('src/components/Home/Login/Login.jsx', 'utf8'), {
  jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2022' },
  module: { type: 'commonjs' },
}).code;

// Execute the actual component with controlled hooks and wallet/RPC responses.
// This checks behavior without sending transactions or needing a wallet extension.
function harness({ account = registered, readFailure = false, receiptFailure = false, deferredRead, deferredReceipt } = {}) {
  const slots = [], effects = [], listeners = {}, routes = [], sends = [];
  let cursor = 0, tree, selected = account, chain = '0x38';
  const navigate = (path) => routes.push(path);
  const params = new URLSearchParams(`ref=${registered}`);
  const changed = (a, b) => !a || b.some((value, i) => value !== a[i]);
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(fn, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) slots[index] = { fn, deps };
      return slots[index].fn;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) {
        slots[index]?.cleanup?.();
        slots[index] = { deps };
        effects.push(() => { slots[index].cleanup = fn(); });
      }
    },
  };
  const ethereum = {
    async request({ method }) {
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return selected ? [selected] : [];
      if (method === 'eth_chainId') return chain;
      if (method === 'wallet_switchEthereumChain') { chain = '0x38'; return; }
      throw Error(`Unexpected wallet request: ${method}`);
    },
    on(event, fn) { listeners[event] = fn; },
    removeListener(event) { delete listeners[event]; },
  };
  const fakeEthers = {
    isAddress: ethers.isAddress,
    BrowserProvider: class { async getSigner() { const address = selected; return { getAddress: async () => address }; } },
    Contract: class {
      async register(referral) {
        sends.push(referral);
        return { wait: async () => { if (receiptFailure) throw Error('Transaction reverted'); if (deferredReceipt) await deferredReceipt; return { status: 1 }; } };
      }
    },
  };
  const modules = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' },
    'react-router-dom': { useNavigate: () => navigate, useSearchParams: () => [params], Link: 'a' },
    ethers: { ethers: fakeEthers },
    '../../../blockchain/bscMainnetConfig': { WALLET_ADD_CHAIN_PARAMS: { chainId: '0x38' } },
    '../../../blockchain/address': { ReferralNetworkAddress: registered },
    '../../../blockchain/referralNetworkABI.json': [],
    '../../../blockchain/registrationReader': { readRegistration: async (method, address) => {
      if (readFailure) throw Error('RPC unavailable');
      if (method === 'rootAddress') return registered;
      if (deferredRead && address === registered) await deferredRead;
      return { exists: address === registered };
    } },
    '/dashboardimg/logo.png': 'logo.png',
    './Login.css': {},
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => {
    assert.ok(name in modules, `Unexpected import ${name}`); return modules[name];
  }, window: { ethereum }, URLSearchParams, setTimeout: () => 0 });
  function render() { cursor = 0; tree = exports.default(); while (effects.length) effects.shift()(); }
  function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    return [node, ...nodes(node.props?.children)];
  }
  render();
  return {
    routes, sends,
    async settle() { for (let i = 0; i < 8; i++) { await new Promise(setImmediate); render(); } },
    registerButton: () => nodes(tree).find(n => n.type === 'button' && ['Register', 'Registering...'].includes(n.props.children)),
    hasReferralInput: () => nodes(tree).some(n => n.type === 'input'),
    changeAccount(address) { selected = address; listeners.accountsChanged(address ? [address] : []); },
    changeChain(value) { chain = value; listeners.chainChanged(value); },
  };
}

test('registered wallet on page load redirects without registration form or transaction', async () => {
  const h = harness(); await h.settle();
  assert.deepEqual(h.routes, ['/dashboard']); assert.equal(h.hasReferralInput(), false); assert.equal(h.registerButton(), undefined); assert.equal(h.sends.length, 0);
});
test('new wallet registers and redirects only after transaction confirmation', async () => {
  let confirm; const deferredReceipt = new Promise(resolve => { confirm = resolve; });
  const h = harness({ account: newcomer, deferredReceipt }); await h.settle();
  assert.equal(h.routes.length, 0); assert.equal(h.hasReferralInput(), true);
  const registering = h.registerButton().props.onClick(); await h.settle();
  assert.deepEqual(h.sends, [registered]); assert.equal(h.routes.length, 0);
  confirm(); await registering; await h.settle(); assert.deepEqual(h.routes, ['/dashboard']);
});
test('failed transaction stays on registration screen', async () => {
  const h = harness({ account: newcomer, receiptFailure: true }); await h.settle();
  await h.registerButton().props.onClick(); await h.settle();
  assert.equal(h.routes.length, 0); assert.equal(h.registerButton().props.disabled, false);
});
test('RPC failure never classifies wallet as unregistered', async () => {
  const h = harness({ readFailure: true }); await h.settle();
  assert.equal(h.routes.length, 0); assert.equal(h.registerButton(), undefined); assert.equal(h.hasReferralInput(), false);
});
test('account change to registered wallet redirects', async () => {
  const h = harness({ account: newcomer }); await h.settle(); h.changeAccount(registered); await h.settle();
  assert.deepEqual(h.routes, ['/dashboard']); assert.equal(h.sends.length, 0);
});
test('old registered wallet response cannot redirect newly selected unregistered wallet', async () => {
  let resolve; const deferredRead = new Promise(r => { resolve = r; });
  const h = harness({ deferredRead }); await h.settle();
  assert.equal(h.hasReferralInput(), false);
  h.changeAccount(newcomer); await h.settle(); resolve(); await h.settle();
  assert.equal(h.routes.length, 0); assert.ok(h.registerButton());
});
test('wrong chain hides registration and changing back retries', async () => {
  const h = harness({ account: newcomer }); await h.settle(); h.changeChain('0x1'); await h.settle();
  assert.equal(h.registerButton(), undefined); h.changeChain('0x38'); await h.settle(); assert.ok(h.registerButton());
});
test('account changed during transaction does not redirect the new unregistered account', async () => {
  let confirm; const deferredReceipt = new Promise(r => { confirm = r; });
  const h = harness({ account: newcomer, deferredReceipt }); await h.settle();
  const registering = h.registerButton().props.onClick(); await h.settle();
  h.changeAccount('0x0000000000000000000000000000000000000456'); await h.settle();
  confirm(); await registering; await h.settle(); assert.equal(h.routes.length, 0); assert.ok(h.registerButton());
});
