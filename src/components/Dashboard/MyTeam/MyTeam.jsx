import { TableCell } from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import CustomTable from "../CommonComponents/CustomTable";
import { ethers } from "ethers";
import ReferralNetworkABI from "../../../blockchain/referralNetworkABI.json";
import PackageManagerABI from "../../../blockchain/packageMangerABI.json";
import V2PackageManagerABI from "../../../blockchain/v2PackageManagerABI";
import V2RegistryABI from "../../../blockchain/v2ReferralRegistryABI";
import {
  PackageManagerAddress,
  ReferralNetworkAddress,
} from "../../../blockchain/address";
import { createBscReadProvider, getBscReadRpcUrls, getReadWalletAddress } from "../../../blockchain/readProvider";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import "../styles/style.css";

// Keep V1 reads to the exact functions needed here. The V1 and V2 registries
// must be queried independently during migration.
const V1_TEAM_READER_ABI = [
  "function users(address user) view returns(uint256 id,address referral,uint256 registeredAt,uint256 totalTeam,uint256 totalTeamDeposit,uint256 selfDeposit,uint256 totalTeamStakeToken,uint256 selfStakeToken,bool exists)",
  "function getLevelUsersLength(address upline,uint256 level) view returns(uint256)",
  "function getLevelUserAt(address upline,uint256 level,uint256 index) view returns(address)",
];
const TEAM_READER_INTERFACE = new ethers.Interface(V1_TEAM_READER_ABI);

// The Vercel proxy has already been verified with these exact calls for the
// affected wallet. Use plain fetch for the critical level list, avoiding the
// mobile-browser ethers FallbackProvider layer that was failing both lists.
const readTeamViaProxy = async (contractAddress, method, args) => {
  const response = await fetch(`${window.location.origin}/api/bsc-rpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: `${method}-${Date.now()}-${Math.random()}`,
      method: "eth_call",
      params: [{
        to: contractAddress,
        data: TEAM_READER_INTERFACE.encodeFunctionData(method, args),
      }, "latest"],
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload?.error?.message || "Team read failed");
  return TEAM_READER_INTERFACE.decodeFunctionResult(method, payload.result)[0];
};

const createV1ReadProvider = () => {
  const makeProvider = (url) => {
    const request = new ethers.FetchRequest(url);
    request.timeout = 20_000;
    return new ethers.JsonRpcProvider(request, V1_MAINNET.chainId, {
      staticNetwork: true, batchMaxCount: 1, batchStallTime: 0,
    });
  };
  // Team lists make several back-to-back reads. PublicNode can occasionally
  // drop one mobile request, so V1 reads fail over to the BSC data seed.
  const urls = [getBscReadRpcUrls()[0], V1_MAINNET.rpcUrl, "https://bsc-dataseed.bnbchain.org"]
    .filter((url, index, all) => Boolean(url) && all.indexOf(url) === index);
  return new ethers.FallbackProvider(urls.map((url, index) => ({
    provider: makeProvider(url), priority: index + 1, stallTimeout: index === 0 ? 3_000 : 1_500, weight: 1,
  })), V1_MAINNET.chainId, { quorum: 1 });
};

const readInBatches = async (items, read, batchSize = 4) => {
  const output = [];
  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);
    output.push(...await Promise.all(batch.map(read)));
  }
  return output;
};

export const MyTeam = () => {
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [teamReadAddress, setTeamReadAddress] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [detailRows, setDetailRows] = useState([]);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const detailPanelRef = useRef(null);

  const levelButtons = Array.from({ length: 15 }, (_, i) => i + 1);

  const referralColumns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "address", label: "Address", sortable: true },
    { id: "registeredAt", label: "Register Time", sortable: true },
    // { id: "packageToken", label: "Total Package (Token)", sortable: true },
    { id: "packageUsdt", label: "Total Package (USDT)", sortable: true },
    { id: "totalTeam", label: "Total Team", sortable: true },
    { id: "totalTeamDeposit", label: "Total Team Deposit", sortable: true },
    { id: "action", label: "Open", sortable: false },
  ];

  const formatTimestamp = (value) => {
    const timestamp = Number(value);

    if (!timestamp) {
      return "-";
    }

    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatEther4 = (value) => {
    try {
      const etherValue = ethers.formatEther(value ?? 0n);
      const [whole, fraction = ""] = etherValue.split(".");
      return `${whole}.${(fraction + "0000").slice(0, 4)}`;
    } catch {
      return "0.0000";
    }
  };

  const formatAddressShort = (address) => {
    if (!address) {
      return "-";
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const detailColumns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "walletAddress", label: "Address", sortable: true },
    { id: "amount", label: "Amount USDT", sortable: true },
    { id: "roi", label: "ROI", sortable: true },
  ];

  const getWalletAddress = async () => {
    if (!window.ethereum) {
      return "";
    }

    const walletAddress = await getReadWalletAddress();

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return "";
    }

    return walletAddress;
  };

  const getCombinedPackageTotal = async (address, v1Manager, v2Manager) => {
    const [v1Result, v2Result] = await Promise.allSettled([
      v1Manager.getStakeHistoryLength(address),
      v2Manager.getPackageHistoryLength(address),
    ]);
    const v1Length = v1Result.status === "fulfilled" ? Number(v1Result.value ?? 0n) : 0;
    const v2Length = v2Result.status === "fulfilled" ? Number(v2Result.value ?? 0n) : 0;
    const [v1StakesResult, v2PackagesResult] = await Promise.allSettled([
      readInBatches(Array.from({ length: v1Length }, (_, index) => index), (index) => v1Manager.userStakeHistory(address, index)),
      readInBatches(Array.from({ length: v2Length }, (_, index) => index), (index) => v2Manager.getPackageHistoryAt(address, index)),
    ]);
    // A missing V2 package record must not hide the user's complete V1 team
    // row (and vice versa). Retain whichever history source answered.
    const v1Stakes = v1StakesResult.status === "fulfilled" ? v1StakesResult.value : [];
    const v2Packages = v2PackagesResult.status === "fulfilled" ? v2PackagesResult.value : [];

    // Every imported V1 package keeps its original timestamp in V2. Count
    // those keys once so only a new V2 package is added to the V1 amount.
    const legacySourceKeys = new Map();
    let v1Total = 0n;
    for (const stake of v1Stakes) {
      const amount = BigInt(stake?.packageValue ?? stake?.[0] ?? 0n);
      const purchasedAt = BigInt(stake?.timestamp ?? stake?.[7] ?? 0n);
      v1Total += amount;
      const key = `${amount}:${purchasedAt}`;
      legacySourceKeys.set(key, (legacySourceKeys.get(key) ?? 0) + 1);
    }
    const v2NewTotal = v2Packages.reduce((total, record) => {
      const amount = BigInt(record?.amount ?? record?.[0] ?? 0n);
      const purchasedAt = BigInt(record?.purchasedAt ?? record?.[1] ?? 0n);
      const key = `${amount}:${purchasedAt}`;
      const legacyCount = legacySourceKeys.get(key) ?? 0;
      if (legacyCount > 0) {
        legacySourceKeys.set(key, legacyCount - 1);
        return total;
      }
      return total + amount;
    }, 0n);
    return v1Total + v2NewTotal;
  };

  const fetchTeamDetails = async (downlineAddress) => {
    if (!window.ethereum || !downlineAddress) {
      setDetailRows([]);
      setDetailsError("");
      return;
    }

    try {
      setIsDetailsLoading(true);
      setDetailsError("");
      const uplineAddress = await getWalletAddress();
      if (!uplineAddress) {
        setDetailRows([]);
        return;
      }

      const provider = createBscReadProvider();
      const referralContract = new ethers.Contract(
        ReferralNetworkAddress,
        ReferralNetworkABI,
        provider,
      );
      const packageManager = new ethers.Contract(
        PackageManagerAddress,
        V2PackageManagerABI,
        provider,
      );

      const packageLengthRaw = await packageManager.getPackageHistoryLength(downlineAddress);
      const packageLength = Number(packageLengthRaw ?? 0n);
      const nextRows = [];
      const levelIndex = selectedLevel - 1;

      for (let index = 0; index < packageLength; index += 1) {
        const stakeData = await packageManager.getPackageHistoryAt(downlineAddress, index);
        let roiRaw = 0n;

        try {
          roiRaw = await referralContract.getLevelRoiClaimableFromUserStake(
            uplineAddress,
            levelIndex,
            downlineAddress,
            index,
          );
        } catch {
          roiRaw = 0n;
        }

        nextRows.push({
          sno: index + 1,
          walletAddress: downlineAddress,
          amount: formatEther4(stakeData?.amount ?? stakeData?.[0] ?? 0n),
          roi: formatEther4(roiRaw ?? 0n),
        });
      }

      setDetailRows(nextRows);
      if (nextRows.length === 0) {
        setDetailsError("No package history found for this team user.");
      }
    } catch {
      setDetailRows([]);
      setDetailsError("Failed to load team history.");
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const handleToggleDetails = (row) => {
    if (selectedRow?.address?.toLowerCase() === row.address.toLowerCase()) {
      setSelectedRow(null);
      setDetailRows([]);
      setDetailsError("");
      return;
    }

    setSelectedRow(row);
    fetchTeamDetails(row.address);
  };

  useEffect(() => {
    const fetchLevelUsers = async () => {
      if (!window.ethereum) {
        setRows([]);
        setLoadError("Connect wallet to load your level-wise team.");
        return;
      }

      try {
        setIsLoading(true);
        const walletAddress = await getWalletAddress();
        if (!walletAddress) {
          setRows([]);
          setLoadError("Connect wallet to load your level-wise team.");
          return;
        }
        setTeamReadAddress(walletAddress);
        setLoadError("");

        const provider = createBscReadProvider();
        const v2ReferralContract = new ethers.Contract(ReferralNetworkAddress, V2RegistryABI, provider);
        const v2Manager = new ethers.Contract(PackageManagerAddress, V2PackageManagerABI, provider);
        const v1Provider = createV1ReadProvider();
        const v1ReferralContract = new ethers.Contract(
          V1_MAINNET.referralNetwork,
          V1_TEAM_READER_ABI,
          v1Provider,
        );
        const v1Manager = new ethers.Contract(V1_MAINNET.packageManager, PackageManagerABI, v1Provider);
        const levelIndex = selectedLevel - 1;
        const readLevelAddresses = async (registryAddress, registry) => {
          let lastError;
          // A retry is important on mobile networks: a failed list call must
          // not be interpreted as an empty level.
          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              const count = Number(await readTeamViaProxy(
                registryAddress, "getLevelUsersLength", [walletAddress, levelIndex],
              ));
              return readInBatches(
                Array.from({ length: count }, (_, index) => index),
                (index) => readTeamViaProxy(registryAddress, "getLevelUserAt", [walletAddress, levelIndex, index]),
              );
            } catch (error) {
              lastError = error;
            }
          }
          // Retain the normal ethers provider only as a local-development
          // fallback. Production list reads use the verified Vercel API path.
          try {
            const count = Number(await registry.getLevelUsersLength(walletAddress, levelIndex));
            return readInBatches(
              Array.from({ length: count }, (_, index) => index),
              (index) => registry.getLevelUserAt(walletAddress, levelIndex),
            );
          } catch {
            throw lastError || new Error("Unable to read level users.");
          }
        };
        const [v1Result, v2Result] = await Promise.allSettled([
          readLevelAddresses(V1_MAINNET.referralNetwork, v1ReferralContract),
          readLevelAddresses(ReferralNetworkAddress, v2ReferralContract),
        ]);
        const v1Addresses = v1Result.status === "fulfilled" ? v1Result.value : [];
        const v2Addresses = v2Result.status === "fulfilled" ? v2Result.value : [];
        const merged = new Map();
        for (const address of v1Addresses) {
          merged.set(address.toLowerCase(), { address, inV1: true, inV2: false });
        }
        for (const address of v2Addresses) {
          const key = address.toLowerCase();
          const existing = merged.get(key);
          merged.set(key, { address, inV1: existing?.inV1 ?? false, inV2: true });
        }
        const nextRows = await Promise.all(Array.from(merged.values()).map(async (member, index) => {
          // A profile/history failure for one contract must never remove a
          // member found in the other contract's level list.
          const [v1User, v2User, packageTotal] = await Promise.all([
            member.inV1 ? v1ReferralContract.users(member.address).catch(() => null) : null,
            member.inV2 ? v2ReferralContract.users(member.address).catch(() => null) : null,
            getCombinedPackageTotal(member.address, v1Manager, v2Manager).catch(() => 0n),
          ]);
          const userData = v2User ?? v1User;
          const v1Team = BigInt(v1User?.totalTeam ?? v1User?.[3] ?? 0n);
          const v2Team = BigInt(v2User?.totalTeam ?? v2User?.[3] ?? 0n);
          const v1Deposit = BigInt(v1User?.totalTeamDeposit ?? v1User?.[4] ?? 0n);
          const v2Deposit = BigInt(v2User?.totalTeamDeposit ?? v2User?.[4] ?? 0n);
          return {
            sno: index + 1,
            address: member.address,
            registeredAt: formatTimestamp(userData?.registeredAt ?? userData?.[2]),
            packageUsdt: formatEther4(packageTotal),
            totalTeam: (v1Team + v2Team).toString(),
            totalTeamDeposit: formatEther4(v1Deposit + v2Deposit),
          };
        }));

        setRows(nextRows);
        const sourceFailures = [
          v1Result.status === "rejected" ? "V1 team RPC did not respond" : "",
          v2Result.status === "rejected" ? "V2 team RPC did not respond" : "",
        ].filter(Boolean);
        const sourceNote = `V1: ${v1Addresses.length}, V2: ${v2Addresses.length}, merged: ${merged.size} for ${formatAddressShort(walletAddress)}.`;
        if (nextRows.length === 0 && merged.size > 0) {
          setLoadError("Team users were found, but package details could not be read. Refresh and try again.");
        } else if (sourceFailures.length) {
          setLoadError(`${sourceFailures.join(". ")}. Please refresh; an RPC failure is not an empty team. ${sourceNote}`);
        } else if (nextRows.length === 0) {
          setLoadError(`No team user found on Level ${selectedLevel}. ${sourceNote}`);
        } else {
          setLoadError("");
        }
        setSelectedRow(null);
        setDetailRows([]);
        setDetailsError("");
      } catch (error) {
        setRows([]);
        setLoadError(error?.shortMessage || error?.message || `Could not load Level ${selectedLevel} team data.`);
        setSelectedRow(null);
        setDetailRows([]);
        setDetailsError("");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLevelUsers();
  }, [selectedLevel]);

  useEffect(() => {
    if (!selectedRow || !detailPanelRef.current) {
      return;
    }

    detailPanelRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [selectedRow, detailRows, detailsError]);

  return (
    <div className="page-container">
      <h1>My Team</h1>
      {teamReadAddress && <p className="team-loading">Reading level team for: {teamReadAddress}</p>}
      <div className="table-wrapper">
        <div className="table-card ">
          <div className="team-levels-wrap">
            {levelButtons.map((level) => (
              <button
                key={level}
                className={`team-level-btn ${selectedLevel === level ? "active" : ""}`}
                onClick={() => setSelectedLevel(level)}
              >
                {level}
              </button>
            ))}
          </div>

          {isLoading && <p className="team-loading">Loading level users...</p>}
          {!isLoading && loadError && <p className="team-loading">{loadError}</p>}

          <CustomTable
            columns={referralColumns}
            rows={rows}
            renderRow={(row) => (
              <>
                <TableCell
                  align="center"
                  onClick={() => handleToggleDetails(row)}
                  sx={{ cursor: "pointer" }}
                >
                  {row.sno}
                </TableCell>
                <TableCell
                  align="center"
                  onClick={() => handleToggleDetails(row)}
                  sx={{ cursor: "pointer" }}
                >
                  {formatAddressShort(row.address)}
                </TableCell>
                <TableCell
                  align="center"
                  className="team-time-cell"
                  onClick={() => handleToggleDetails(row)}
                  sx={{ cursor: "pointer" }}
                >
                  {row.registeredAt}
                </TableCell>
                {/* <TableCell
                  align="center"
                  onClick={() => handleToggleDetails(row)}
                  sx={{ cursor: "pointer" }}
                >
                  {row.packageToken}
                </TableCell> */}
                <TableCell
                  align="center"
                  onClick={() => handleToggleDetails(row)}
                  sx={{ cursor: "pointer" }}
                >
                  {row.packageUsdt}
                </TableCell>
                <TableCell
                  align="center"
                  onClick={() => handleToggleDetails(row)}
                  sx={{ cursor: "pointer" }}
                >
                  {row.totalTeam}
                </TableCell>
                <TableCell
                  align="center"
                  onClick={() => handleToggleDetails(row)}
                  sx={{ cursor: "pointer" }}
                >
                  {row.totalTeamDeposit}
                </TableCell>
                <TableCell
                  align="center"
                  onClick={() => handleToggleDetails(row)}
                  sx={{ cursor: "pointer" }}
                >
                  <i
                    className={`bi bi-chevron-${
                      selectedRow?.address?.toLowerCase() === row.address.toLowerCase()
                        ? "up"
                        : "down"
                    }`}
                  ></i>
                </TableCell>
              </>
            )}
          />

          {selectedRow && (
            <div className="team-detail-panel" ref={detailPanelRef}>
              <div className="team-detail-header">
                <h2>Address</h2>
                <button
                  className="team-detail-close"
                  onClick={() => {
                    setSelectedRow(null);
                    setDetailRows([]);
                    setDetailsError("");
                  }}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <p className="team-detail-address">{selectedRow.address}</p>
              <h2>ROI</h2>
              {isDetailsLoading && <p className="team-loading">Loading ROI details...</p>}
              {!isDetailsLoading && detailsError && (
                <p className="team-loading">{detailsError}</p>
              )}
              <div className="team-detail-scroll">
                <CustomTable
                  columns={detailColumns}
                  rows={detailRows}
                  renderRow={(row) => (
                    <>
                      <TableCell align="center">{row.sno}</TableCell>
                      <TableCell align="center">
                        {formatAddressShort(row.walletAddress)}
                      </TableCell>
                      <TableCell align="center">{row.amount}</TableCell>
                      <TableCell align="center">{row.roi}</TableCell>
                    </>
                  )}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyTeam;
