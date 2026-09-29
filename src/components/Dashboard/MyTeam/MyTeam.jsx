import { TableCell } from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import CustomTable from "../CommonComponents/CustomTable";
import { ethers } from "ethers";
import ReferralNetworkABI from "../../../blockchain/referralNetworkABI.json";
import PackageManagerABI from "../../../blockchain/packageMangerABI.json";
import V2PackageManagerABI from "../../../blockchain/v2PackageManagerABI";
import {
  PackageManagerAddress,
  ReferralNetworkAddress,
} from "../../../blockchain/address";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
import "../styles/style.css";

const createV1ReadProvider = () => {
  const request = new ethers.FetchRequest(V1_MAINNET.rpcUrl);
  // Public V1 RPCs are more reliable with small individual requests.
  return new ethers.JsonRpcProvider(request, V1_MAINNET.chainId, {
    staticNetwork: true,
    batchMaxCount: 1,
    batchStallTime: 0,
  });
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
    const [v1Stakes, v2Packages] = await Promise.all([
      readInBatches(Array.from({ length: v1Length }, (_, index) => index), (index) => v1Manager.userStakeHistory(address, index)),
      readInBatches(Array.from({ length: v2Length }, (_, index) => index), (index) => v2Manager.getPackageHistoryAt(address, index)),
    ]);

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
        return;
      }

      try {
        setIsLoading(true);
        const walletAddress = await getWalletAddress();
        if (!walletAddress) {
          setRows([]);
          return;
        }

        const provider = createBscReadProvider();
        const v2ReferralContract = new ethers.Contract(
          ReferralNetworkAddress,
          ReferralNetworkABI,
          provider,
        );
        const v2Manager = new ethers.Contract(PackageManagerAddress, V2PackageManagerABI, provider);
        const v1Provider = createV1ReadProvider();
        const v1ReferralContract = new ethers.Contract(
          V1_MAINNET.referralNetwork,
          ReferralNetworkABI,
          v1Provider,
        );
        const v1Manager = new ethers.Contract(V1_MAINNET.packageManager, PackageManagerABI, v1Provider);
        const levelIndex = selectedLevel - 1;
        const readLevel = async (registry) => {
          const count = Number(await registry.getLevelUsersLength(walletAddress, levelIndex));
          const addresses = await readInBatches(
            Array.from({ length: count }, (_, index) => index),
            (index) => registry.getLevelUserAt(walletAddress, levelIndex),
          );
          return readInBatches(addresses, async (address) => ({ address, user: await registry.users(address) }));
        };
        const [v1Result, v2Result] = await Promise.allSettled([
          readLevel(v1ReferralContract),
          readLevel(v2ReferralContract),
        ]);
        const merged = new Map();
        for (const item of v1Result.status === "fulfilled" ? v1Result.value : []) {
          merged.set(item.address.toLowerCase(), { address: item.address, v1User: item.user, v2User: null });
        }
        for (const item of v2Result.status === "fulfilled" ? v2Result.value : []) {
          const key = item.address.toLowerCase();
          const existing = merged.get(key);
          merged.set(key, { address: item.address, v1User: existing?.v1User ?? null, v2User: item.user });
        }
        const nextRows = await readInBatches(Array.from(merged.values()), async (member, index) => {
          const userData = member.v2User ?? member.v1User;
          const packageTotal = await getCombinedPackageTotal(member.address, v1Manager, v2Manager);
          const source = member.v1User && member.v2User ? "V1 + V2" : member.v2User ? "V2" : "V1";
          return {
            sno: index + 1,
            address: member.address,
            registeredAt: formatTimestamp(userData?.registeredAt ?? userData?.[2]),
            source,
            packageToken: formatEther4(userData?.selfStakeToken ?? userData?.[7] ?? 0n),
            packageUsdt: formatEther4(packageTotal),
            totalTeam: (userData?.totalTeam ?? userData?.[3] ?? 0n).toString(),
            totalTeamDeposit: formatEther4(userData?.totalTeamDeposit ?? userData?.[4] ?? 0n),
          };
        });

        setRows(nextRows);
        setSelectedRow(null);
        setDetailRows([]);
        setDetailsError("");
      } catch {
        setRows([]);
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
