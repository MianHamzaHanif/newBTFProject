export type PackageTier = {
  id: string;
  name: string;
  price: number;
  dailyRewardRate: number;
  dailyRewardUsdt: number;
  totalRoiLimit: string;
  totalRoiUsdt: string;
  workingLimit: string;
  workingLimitUsdt: string;
  recommended?: boolean;
};

export const CONTRACT_CONFIG = {
  address: import.meta.env.VITE_BTF_V2_PACKAGE_MANAGER_ADDRESS || '',
  explorerUrl: `https://testnet.bscscan.com/address/${import.meta.env.VITE_BTF_V2_PACKAGE_MANAGER_ADDRESS || ''}`,
  domain: 'app.btf.finance',
};

export const PACKAGES: PackageTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 25,
    dailyRewardRate: 0.5,
    dailyRewardUsdt: 0.125,
    totalRoiLimit: '3X',
    totalRoiUsdt: '75',
    workingLimit: '3X',
    workingLimitUsdt: '75',
  },
  {
    id: 'builder',
    name: 'Builder',
    price: 100,
    dailyRewardRate: 0.5,
    dailyRewardUsdt: 0.5,
    totalRoiLimit: '3X',
    totalRoiUsdt: '300',
    workingLimit: '5X',
    workingLimitUsdt: '500',
    recommended: true,
  },
  {
    id: 'leader',
    name: 'Leader',
    price: 500,
    dailyRewardRate: 0.5,
    dailyRewardUsdt: 2.5,
    totalRoiLimit: '3X',
    totalRoiUsdt: '1500',
    workingLimit: '7X',
    workingLimitUsdt: '3500',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 1000,
    dailyRewardRate: 0.5,
    dailyRewardUsdt: 5,
    totalRoiLimit: '3X',
    totalRoiUsdt: '3000',
    workingLimit: '10X',
    workingLimitUsdt: '10000',
  },
];

export const LEVEL_INCOME_DATA = [
  { level: 1, percentage: 10, requirement: '1 Direct',    exampleUsers: 5, perUserIncome: 0.050, dailyIncome: 0.25 },
  { level: 2, percentage: 10, requirement: '2 Directs',   exampleUsers: 25, perUserIncome: 0.050, dailyIncome: 1.25 },
  { level: 3, percentage: 10, requirement: '3 Directs',   exampleUsers: 125, perUserIncome: 0.050, dailyIncome: 6.25 },
  { level: 4, percentage: 10, requirement: '4 Directs',   exampleUsers: 625, perUserIncome: 0.050, dailyIncome: 31.25 },
  { level: 5, percentage: 10, requirement: '5 Directs',   exampleUsers: 3125, perUserIncome: 0.050, dailyIncome: 156.25 },
  { level: 6, percentage: 5, requirement: '6 Directs',    exampleUsers: 15625, perUserIncome: 0.025, dailyIncome: 390.625 },
  { level: 7, percentage: 5, requirement: '7 Directs',    exampleUsers: 78125, perUserIncome: 0.025, dailyIncome: 1953.125 },
  { level: 8, percentage: 5, requirement: '8 Directs',    exampleUsers: 390625, perUserIncome: 0.025, dailyIncome: 9765.625 },
  { level: 9, percentage: 5, requirement: '9 Directs',    exampleUsers: 1953125, perUserIncome: 0.025, dailyIncome: 48828.125 },
  { level: 10, percentage: 5, requirement: '10 Directs', exampleUsers: 9765625, perUserIncome: 0.025, dailyIncome: 244140.625 },
  { level: 11, percentage: 5, requirement: '10 Directs + $500 Direct Vol', exampleUsers: 48828125, perUserIncome: 0.025, dailyIncome: 1220703.125 },
  { level: 12, percentage: 5, requirement: '10 Directs + $600 Direct Vol', exampleUsers: 244140625, perUserIncome: 0.025, dailyIncome: 6103515.625 },
  { level: 13, percentage: 5, requirement: '10 Directs + $700 Direct Vol', exampleUsers: 1220703125, perUserIncome: 0.025, dailyIncome: 30517578.125 },
  { level: 14, percentage: 5, requirement: '10 Directs + $800 Direct Vol', exampleUsers: 6103515625, perUserIncome: 0.025, dailyIncome: 152587890.625 },
  { level: 15, percentage: 5, requirement: '10 Directs + $1000 Direct Vol', exampleUsers: 30517578125, perUserIncome: 0.025, dailyIncome: 762939453.125 },
];

export const POWER_RANKS = [
  { rank: 'P1', business: 2500, salary: 25, frequency: 'Every 10 days', times: 20, totalSalary: 500 },
  { rank: 'P2', business: 5000, salary: 50, frequency: 'Every 10 days', times: 20, totalSalary: 1000 },
  { rank: 'P3', business: 10000, salary: 100, frequency: 'Every 10 days', times: 20, totalSalary: 2000 },
  { rank: 'P4', business: 25000, salary: 250, frequency: 'Every 10 days', times: 20, totalSalary: 5000 },
  { rank: 'P5', business: 50000, salary: 500, frequency: 'Every 10 days', times: 20, totalSalary: 10000 },
  { rank: 'P6', business: 100000, salary: 1000, frequency: 'Every 10 days', times: 20, totalSalary: 20000 },
  { rank: 'P7', business: 250000, salary: 2500, frequency: 'Every 10 days', times: 20, totalSalary: 50000 },
  { rank: 'P8', business: 500000, salary: 5000, frequency: 'Every 10 days', times: 20, totalSalary: 100000 },
  { rank: 'P9', business: 1000000, salary: 10000, frequency: 'Every 10 days', times: 20, totalSalary: 200000 },
];

export const REWARD_RANKS = [
  { rank: 'R1', business: 5000, reward: '$250', frequencyNote: 'One-time reward milestone' },
  { rank: 'R2', business: 10000, reward: '$500', frequencyNote: 'One-time reward milestone' },
  { rank: 'R3', business: 25000, reward: '$1,250', frequencyNote: 'One-time reward milestone' },
  { rank: 'R4', business: 50000, reward: '$2,500', frequencyNote: 'One-time reward milestone' },
  { rank: 'R5', business: 100000, reward: '$5,000', frequencyNote: 'One-time reward milestone' },
  { rank: 'R6', business: 250000, reward: '$5,000', frequencyNote: 'Monthly 2 times' },
  { rank: 'R7', business: 500000, reward: '$5,000', frequencyNote: 'Monthly 4 times' },
  { rank: 'R8', business: 1000000, reward: '$5,000', frequencyNote: 'Monthly 8 times' },
  { rank: 'R9', business: 2500000, reward: '$5,000', frequencyNote: 'Monthly 16 times' },
  { rank: 'R10', business: 5000000, reward: '$5,000', frequencyNote: 'Monthly 32 times' },
  { rank: 'R11', business: 10000000, reward: '$5,000', frequencyNote: 'Monthly 64 times' },
  { rank: 'R12', business: 25000000, reward: '$5,000', frequencyNote: 'Monthly 128 times' },
];

export const PROTOCOL_RULES = [
  {
    title: 'Minimum Withdrawal',
    detail: '10 USDT minimum threshold for all on-chain withdrawals.',
  },
  {
    title: 'Processing Fee',
    detail: '7% automated smart contract fee deducted on all withdrawal streams (Direct, ROI Level, Salary, and Reward).',
  },
  {
    title: 'Earnings Cap & Upgrades',
    detail: 'Total returns are strictly capped according to your active package limit. Upgrading your tier is required to continue earning once capped.',
  },
  {
    title: '40% Single-Leg Rule',
    detail: 'For Power and Reward rank qualification, a maximum of 40% of the qualifying turnover is counted from any single leg, ensuring balanced team building.',
  },
  {
    title: 'Ownership Renounced',
    detail: 'No administrative keys or backdoors exist. Payout logic and contract distributions run purely autonomously on-chain.',
  },
];
