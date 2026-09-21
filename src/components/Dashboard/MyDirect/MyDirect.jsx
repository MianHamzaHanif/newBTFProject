import { TableCell } from "@mui/material";
import React, { useEffect, useState } from "react";
import CustomTable from "../CommonComponents/CustomTable";
import { ethers } from "ethers";
import ReferralNetworkABI from "../../../blockchain/referralNetworkABI.json";
import { ReferralNetworkAddress } from "../../../blockchain/address";
import { createBscReadProvider } from "../../../blockchain/readProvider";
import { getReadWalletAddress } from "../../../blockchain/readProvider";
import "../styles/style.css";

export const MyDirect = () => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const referralColumns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "address", label: "Wallet Address", sortable: true },
    { id: "registeredAt", label: "Register Time", sortable: true },
    // { id: "packageToken", label: "Total Package (Token)", sortable: true },
    { id: "packageUsdt", label: "Total Package (USDT)", sortable: true },
    { id: "totalTeam", label: "Total Team", sortable: true },
    { id: "totalTeamDeposit", label: "Total Team Deposit", sortable: true },
    { id: "totalLegBusiness", label: "Total Leg Business", sortable: true },
  ];

  const formatAddressShort = (address) => {
    if (!address) {
      return "-";
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

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

  useEffect(() => {
    const fetchDirectUsers = async () => {
      if (!window.ethereum) {
        setRows([]);
        return;
      }

      try {
        setIsLoading(true);
        const walletAddress = await getReadWalletAddress();

        if (!walletAddress || !ethers.isAddress(walletAddress)) {
          setRows([]);
          return;
        }

        const provider = createBscReadProvider();
        const referralContract = new ethers.Contract(
          ReferralNetworkAddress,
          ReferralNetworkABI,
          provider,
        );

        const levelIndex = 0;
        const length = await referralContract.getLevelUsersLength(
          walletAddress,
          levelIndex,
        );

        const nextRows = [];
        const directUsersLength = Number(length);

        for (let loopIndex = 0; loopIndex < directUsersLength; loopIndex += 1) {
          const userAddress = await referralContract.getLevelUserAt(
            walletAddress,
            levelIndex,
            loopIndex,
          );
          const userData = await referralContract.users(userAddress);
          const packageUsdtRaw = userData?.selfDeposit ?? userData?.[5] ?? 0n;
          const totalTeamDepositRaw = userData?.totalTeamDeposit ?? userData?.[4] ?? 0n;

          nextRows.push({
            sno: loopIndex + 1,
            address: userAddress,
            registeredAt: formatTimestamp(userData?.registeredAt ?? userData?.[2]),
            packageToken: formatEther4(userData?.selfStakeToken ?? userData?.[7] ?? 0n),
            packageUsdt: formatEther4(packageUsdtRaw),
            totalTeam: (userData?.totalTeam ?? userData?.[3] ?? 0n).toString(),
            totalTeamDeposit: formatEther4(totalTeamDepositRaw),
            totalLegBusiness: formatEther4(packageUsdtRaw + totalTeamDepositRaw),
          });
        }

        setRows(nextRows);
      } catch {
        setRows([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDirectUsers();
  }, []);

  return (
    <div className="page-container">
      <h1>My Direct</h1>
      <div className="table-wrapper">
        <div className="table-card ">
          {isLoading && <p className="team-loading">Loading direct users...</p>}

          <CustomTable
            columns={referralColumns}
            rows={rows}
            renderRow={(row) => (
              <>
                <TableCell align="center">{row.sno}</TableCell>
                <TableCell align="center">{formatAddressShort(row.address)}</TableCell>
                <TableCell align="center" className="team-time-cell">
                  {row.registeredAt}
                </TableCell>
                {/* <TableCell align="center">{row.packageToken}</TableCell> */}
                <TableCell align="center">{row.packageUsdt}</TableCell>
                <TableCell align="center">{row.totalTeam}</TableCell>
                <TableCell align="center">{row.totalTeamDeposit}</TableCell>
                <TableCell align="center">{row.totalLegBusiness}</TableCell>
              </>
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default MyDirect;
