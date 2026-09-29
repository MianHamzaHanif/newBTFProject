import { TableCell } from "@mui/material";
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2RegistryABI from "../../../blockchain/v2ReferralRegistryABI";
import { ReferralNetworkAddress } from "../../../blockchain/address";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
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
        const v2Registry = new ethers.Contract(ReferralNetworkAddress, V2RegistryABI, createBscReadProvider());
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
        if (v2Result.status === "rejected") failures.push("V2 directs could not be loaded");

        // A migrated V1 direct belongs in the V2 row only. V1-only directs
        // remain visible until they are migrated, while new V2 directs show
        // naturally as V2.
        const v2Addresses = new Set(v2Directs.map(({ address }) => address.toLowerCase()));
        const combined = [
          ...v1Directs.filter(({ address }) => !v2Addresses.has(address.toLowerCase())).map(({ address, user }) => ({ source: "V1", address, user })),
          ...v2Directs.map(({ address, user }) => ({ source: "V2", address, user })),
        ].map(({ source, address, user }, index) => {
          const selfDeposit = user.selfDeposit ?? user[5] ?? 0n;
          const teamDeposit = user.totalTeamDeposit ?? user[4] ?? 0n;
          return {
            sno: index + 1,
            source,
            address,
            registeredAt: formatTime(user.registeredAt ?? user[2]),
            packageUsdt: formatUsdt(selfDeposit),
            totalTeam: (user.totalTeam ?? user[3] ?? 0n).toString(),
            totalTeamDeposit: formatUsdt(teamDeposit),
            totalLegBusiness: formatUsdt(selfDeposit + teamDeposit),
          };
        });

        if (cancelled) return;
        setRows(combined);
        setMessage(failures.length ? `${failures.join(". ")}. Other available directs are shown.` : combined.length ? "" : "No V1 or V2 direct user found.");
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
    { id: "source", label: "Source", sortable: true },
    { id: "address", label: "Wallet Address", sortable: true },
    { id: "registeredAt", label: "Register Time", sortable: true },
    { id: "packageUsdt", label: "Self Package (USDT)", sortable: true },
    { id: "totalTeam", label: "Total Team", sortable: true },
    { id: "totalTeamDeposit", label: "Total Team Deposit", sortable: true },
    { id: "totalLegBusiness", label: "Total Leg Business", sortable: true },
  ];

  return <div className="page-container"><h1>My Direct</h1><div className="table-wrapper"><div className="table-card">
    {isLoading && <p className="team-loading">Loading V1 and V2 direct users...</p>}
    {!isLoading && message && <p className="team-loading">{message}</p>}
    <CustomTable columns={columns} rows={rows} renderRow={(row) => <>
      <TableCell align="center">{row.sno}</TableCell>
      <TableCell align="center"><span className={`${row.source === "V2" ? "active" : "in-active"} status`}>{row.source}</span></TableCell>
      <TableCell align="center">{shortAddress(row.address)}</TableCell>
      <TableCell align="center" className="team-time-cell">{row.registeredAt}</TableCell>
      <TableCell align="center">{row.packageUsdt}</TableCell>
      <TableCell align="center">{row.totalTeam}</TableCell>
      <TableCell align="center">{row.totalTeamDeposit}</TableCell>
      <TableCell align="center">{row.totalLegBusiness}</TableCell>
    </>} />
  </div></div></div>;
};

export default MyDirect;
