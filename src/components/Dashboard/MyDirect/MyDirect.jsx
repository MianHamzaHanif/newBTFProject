import { TableCell } from "@mui/material";
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import PackageManagerABI from "../../../blockchain/packageMangerABI.json";
import V2RegistryABI from "../../../blockchain/v2ReferralRegistryABI";
import { V3ReferralRegistryAddress } from "../../../blockchain/address";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import { loadPrioritizedPackageHistory } from "../../../blockchain/prioritizedPackageHistory";
import "../styles/style.css";

const V1_DIRECT_READER_ABI = [
  "function getLevelUsersLength(address upline,uint256 level) view returns(uint256)",
  "function getLevelUserAt(address upline,uint256 level,uint256 index) view returns(address)",
  "function users(address user) view returns(uint256 id,address referral,uint256 registeredAt,uint256 totalTeam,uint256 totalTeamDeposit,uint256 selfDeposit,uint256 totalTeamStakeToken,uint256 selfStakeToken,bool exists)",
];

const shortAddress = (address) => address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "-";
const formatTime = (value) => {
  const timestamp = Number(value ?? 0n);
  return timestamp ? new Date(timestamp * 1000).toLocaleString() : "-";
};
const formatUsdt = (value) => {
  try {
    return Number(ethers.formatEther(value ?? 0n)).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  } catch { return "0.0000"; }
};
const readInBatches = async (items, reader, size = 10) => {
  const output = [];
  for (let start = 0; start < items.length; start += size) {
    output.push(...await Promise.all(items.slice(start, start + size).map(reader)));
  }
  return output;
};
const createV1ReadProvider = () => {
  const request = new ethers.FetchRequest(V1_MAINNET.rpcUrl);
  request.timeout = 30_000;
  return new ethers.JsonRpcProvider(request, V1_MAINNET.chainId, { staticNetwork: true, batchMaxCount: 1, batchStallTime: 0 });
};

const combinedPackageTotal = async (address) => {
  const { records } = await loadPrioritizedPackageHistory(address);
  return records.reduce((total, record) => total + BigInt(record.amount ?? 0n), 0n);
};

// A V1 active-level snapshot is copied into V2's team-deposit balance during
// the Level Business seed.  The separate legacyLevelRemaining balance lets us
// remove that already-counted V1 portion before adding genuinely new V2 team
// business in the My Direct table.
const v2NewTeamBusiness = async (address, v2User, v2Registry) => {
  const v2Total = BigInt(v2User?.totalTeamDeposit ?? v2User?.[4] ?? 0n);
  if (!v2User || v2Total === 0n) return 0n;
  const legacySeeded = (await Promise.all(
    Array.from({ length: 15 }, (_, level) => v2Registry.legacyLevelRemaining(address, level)),
  )).reduce((total, amount) => total + BigInt(amount), 0n);
  return v2Total > legacySeeded ? v2Total - legacySeeded : 0n;
};

export const MyDirect = () => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fetchDirectUsers = async () => {
      try {
        setIsLoading(true);
        setMessage("");
        const walletAddress = await getReadWalletAddress();
        if (!ethers.isAddress(walletAddress)) throw new Error("Please connect your wallet to view direct users.");

        const v1Registry = new ethers.Contract(V1_MAINNET.referralNetwork, V1_DIRECT_READER_ABI, createV1ReadProvider());
        const v2Registry = new ethers.Contract(V3ReferralRegistryAddress, V2RegistryABI, createBscReadProvider());
        const v1Manager = new ethers.Contract(V1_MAINNET.packageManager, PackageManagerABI, createV1ReadProvider());
        const [v1Result, v2Result] = await Promise.allSettled([
          (async () => {
            const count = Number(await v1Registry.getLevelUsersLength(walletAddress, 0));
            const addresses = await readInBatches(Array.from({ length: count }, (_, index) => index), (index) => v1Registry.getLevelUserAt(walletAddress, 0, index));
            return readInBatches(addresses, async (address) => ({ address, user: await v1Registry.users(address) }));
          })(),
          (async () => {
            const count = Number(await v2Registry.getLevelUsersLength(walletAddress, 0));
            const addresses = await readInBatches(Array.from({ length: count }, (_, index) => index), (index) => v2Registry.getLevelUserAt(walletAddress, 0, index));
            return readInBatches(addresses, async (address) => ({ address, user: await v2Registry.users(address) }));
          })(),
        ]);

        const v1Directs = v1Result.status === "fulfilled" ? v1Result.value : [];
        const v2Directs = v2Result.status === "fulfilled" ? v2Result.value : [];
        const failures = [];
        if (v1Result.status === "rejected") failures.push("V1 directs could not be loaded");
        if (v2Result.status === "rejected") failures.push("V3 directs could not be loaded");

        const merged = new Map();
        for (const { address, user } of v1Directs) {
          merged.set(address.toLowerCase(), { address, v1User: user, v2User: null });
        }
        for (const { address, user } of v2Directs) {
          const previous = merged.get(address.toLowerCase());
          merged.set(address.toLowerCase(), { address, v1User: previous?.v1User ?? null, v2User: user });
        }
        const combined = await readInBatches(Array.from(merged.values()), async ({ address, v1User, v2User }) => {
          const user = v2User ?? v1User;
          const [selfBusiness, v2TeamBusiness] = await Promise.all([
            combinedPackageTotal(address),
            v2NewTeamBusiness(address, v2User, v2Registry),
          ]);
          // V1 business appears once. Only V2 business that is not the V1
          // seed is added, so seeded users cannot be displayed twice.
          const teamBusiness = BigInt(v1User?.totalTeamDeposit ?? v1User?.[4] ?? 0n) + v2TeamBusiness;
          return {
            address,
            registeredAt: formatTime(user.registeredAt ?? user[2]),
            packageUsdt: formatUsdt(selfBusiness),
            teamBusiness: formatUsdt(teamBusiness),
            totalTeam: (user.totalTeam ?? user[3] ?? 0n).toString(),
          };
        }, 4);

        // `readInBatches` restarts its callback index in every batch. Number
        // rows only after all V1/V2 directs are merged so S. No remains
        // globally sequential: 1, 2, 3 ... rather than repeating per batch.
        const numberedRows = combined.map((row, index) => ({ ...row, sno: index + 1 }));

        if (cancelled) return;
        setRows(numberedRows);
        setMessage(failures.length ? `${failures.join(". ")}. Other available directs are shown.` : numberedRows.length ? "" : "No direct user found.");
      } catch (error) {
        if (!cancelled) {
          setRows([]);
          setMessage(error?.shortMessage || error?.reason || error?.message || "Failed to load direct users.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchDirectUsers();
    return () => { cancelled = true; };
  }, []);

  const columns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "address", label: "Wallet Address", sortable: true },
    { id: "registeredAt", label: "Register Time", sortable: true },
    { id: "packageUsdt", label: "Self Business (USDT)", sortable: true },
    { id: "teamBusiness", label: "Team Business", sortable: true },
    { id: "totalTeam", label: "Total Team", sortable: true },
  ];

  return <div className="page-container"><h1>My Direct</h1><div className="table-wrapper"><div className="table-card">
    {isLoading && <p className="team-loading">Loading direct users...</p>}
    {!isLoading && message && <p className="team-loading">{message}</p>}
    <CustomTable columns={columns} rows={rows} renderRow={(row) => <>
      <TableCell align="center">{row.sno}</TableCell>
      <TableCell align="center">{shortAddress(row.address)}</TableCell>
      <TableCell align="center" className="team-time-cell">{row.registeredAt}</TableCell>
      <TableCell align="center">{row.packageUsdt}</TableCell>
      <TableCell align="center">{row.teamBusiness}</TableCell>
      <TableCell align="center">{row.totalTeam}</TableCell>
    </>} />
  </div></div></div>;
};

export default MyDirect;
