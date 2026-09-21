import { TableCell } from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import CustomTable from "../CommonComponents/CustomTable";
import { ethers } from "ethers";
import ReferralNetworkABI from "../../../blockchain/referralNetworkABI.json";
import PackageManagerLensABI from "../../../blockchain/packageManagerLensABI.json";
import {
  PackageManagerLensAddress,
  ReferralNetworkAddress,
} from "../../../blockchain/address";
import { createBscReadProvider } from "../../../blockchain/readProvider";
import { getReadWalletAddress } from "../../../blockchain/readProvider";
import "../styles/style.css";

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
      const packageManagerLens = new ethers.Contract(
        PackageManagerLensAddress,
        PackageManagerLensABI,
        provider,
      );

      const packageLengthRaw = await packageManagerLens.getStakeHistoryLength(downlineAddress);
      const packageLength = Number(packageLengthRaw ?? 0n);
      const nextRows = [];
      const levelIndex = selectedLevel - 1;

      for (let index = 0; index < packageLength; index += 1) {
        const stakeData = await packageManagerLens.getStakeHistoryAt(downlineAddress, index);
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
          amount: formatEther4(stakeData?.usdtAmount ?? stakeData?.[1] ?? 0n),
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
        const referralContract = new ethers.Contract(
          ReferralNetworkAddress,
          ReferralNetworkABI,
          provider,
        );

        const levelIndex = selectedLevel - 1;
        const length = await referralContract.getLevelUsersLength(
          walletAddress,
          levelIndex,
        );

        const nextRows = [];
        const levelUsersLength = Number(length);

        for (let loopIndex = 0; loopIndex < levelUsersLength; loopIndex += 1) {
          const userAddress = await referralContract.getLevelUserAt(
            walletAddress,
            levelIndex,
            loopIndex,
          );
          const userData = await referralContract.users(userAddress);

          nextRows.push({
            sno: loopIndex + 1,
            address: userAddress,
            registeredAt: formatTimestamp(userData?.registeredAt ?? userData?.[2]),
            packageToken: formatEther4(userData?.selfStakeToken ?? userData?.[7] ?? 0n),
            packageUsdt: formatEther4(userData?.selfDeposit ?? userData?.[5] ?? 0n),
            totalTeam: (userData?.totalTeam ?? userData?.[3] ?? 0n).toString(),
            totalTeamDeposit: formatEther4(
              userData?.totalTeamDeposit ?? userData?.[4] ?? 0n,
            ),
          });
        }

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
