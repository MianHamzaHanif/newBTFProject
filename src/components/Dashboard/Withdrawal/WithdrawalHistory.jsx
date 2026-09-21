import { TableCell } from "@mui/material";
import React, { useEffect, useState } from "react";
import CustomTable from "../CommonComponents/CustomTable";
import { ethers } from "ethers";
import ReferralNetworkABI from "../../../blockchain/referralNetworkABI.json";
import PackageManagerABI from "../../../blockchain/packageMangerABI.json";
import {
  PackageManagerAddress,
  ReferralNetworkAddress,
} from "../../../blockchain/address";
import { BSC_MAINNET } from "../../../blockchain/bscMainnetConfig";
import { getReadWalletAddress } from "../../../blockchain/readProvider";

export const WithdrawalHistory = () => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [withdrawFeeBP, setWithdrawFeeBP] = useState(0n);
  const [loadError, setLoadError] = useState("");

  const referralColumns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "directAmount", label: "Direct", sortable: true },
    { id: "selfRoiAmount", label: "Self ROI", sortable: true },
    { id: "levelRoiAmount", label: "Level ROI", sortable: true },
    { id: "powerAmount", label: "Power", sortable: true },
    { id: "rewardAmount", label: "Reward", sortable: true },
    { id: "usdAmount", label: "USD Amount", sortable: true },
    {
      id: "netUsdAmount",
      label: `USD After Fee (${formatFeePercent(withdrawFeeBP)})`,
      sortable: true,
    },
    { id: "time", label: "Time", sortable: true },
  ];

  const formatEther4 = (value) => {
    try {
      const etherValue = ethers.formatEther(value ?? 0n);
      const [whole, fraction = ""] = etherValue.split(".");
      return `${whole}.${(fraction + "0000").slice(0, 4)}`;
    } catch {
      return "0.0000";
    }
  };

  const formatTimestamp = (value) => {
    const ts = Number(value);
    if (!ts) {
      return "-";
    }
    return new Date(ts * 1000).toLocaleString();
  };

  function formatFeePercent(value) {
    const feeBP = Number(value ?? 0n);
    return `${(feeBP / 100).toFixed(4)}%`;
  }

  const getNetAmount = (amount, feeBP) => {
    const rawAmount = amount ?? 0n;
    const rawFeeBP = feeBP ?? 0n;
    return rawAmount - (rawAmount * rawFeeBP) / 10000n;
  };

  useEffect(() => {
    const fetchHistory = async () => {
      if (!window.ethereum) {
        setRows([]);
        setLoadError("MetaMask not found.");
        return;
      }

      try {
        setIsLoading(true);
        setLoadError("");
        const walletAddress = await getReadWalletAddress();

        if (!walletAddress || !ethers.isAddress(walletAddress)) {
          setRows([]);
          setLoadError("Please connect wallet to view withdrawal history.");
          return;
        }

        const provider = new ethers.JsonRpcProvider(
          BSC_MAINNET.rpcUrls[1], BSC_MAINNET.chainId, { staticNetwork: true },
        );
        const referralContract = new ethers.Contract(
          ReferralNetworkAddress,
          ReferralNetworkABI,
          provider,
        );
        const packageManagerContract = new ethers.Contract(
          PackageManagerAddress,
          PackageManagerABI,
          provider,
        );

        const [userLen, feeBP] = await Promise.all([
          referralContract.getUserWithdrawSummaryRecordsLength(walletAddress),
          packageManagerContract.withdrawFeeBP(),
        ]);

        setWithdrawFeeBP(feeBP ?? 0n);

        const records = await Promise.all(
          Array.from({ length: Number(userLen ?? 0n) }, (_, rowIndex) =>
            referralContract.userWithdrawSummaryRecords(
              walletAddress,
              Number(userLen) - 1 - rowIndex,
            ),
          ),
        );
        const nextRows = records.flatMap((rec) => {
          const usdAmountRaw = rec?.usdAmount ?? rec?.[11] ?? 0n;
          if ((usdAmountRaw ?? 0n) === 0n) return [];
          return {
            sno: 0,
            directAmount: formatEther4(rec?.directAmount ?? rec?.[1] ?? 0n),
            selfRoiAmount: formatEther4(rec?.selfRoiAmount ?? rec?.[2] ?? 0n),
            levelRoiAmount: formatEther4(rec?.levelRoiAmount ?? rec?.[3] ?? 0n),
            powerAmount: formatEther4(rec?.powerAmount ?? rec?.[4] ?? 0n),
            rewardAmount: formatEther4(rec?.rewardAmount ?? rec?.[5] ?? 0n),
            usdAmount: formatEther4(usdAmountRaw),
            netUsdAmount: formatEther4(getNetAmount(usdAmountRaw, feeBP)),
            time: formatTimestamp(rec?.timestamp ?? rec?.[12]),
          };
        }).map((row, index) => ({ ...row, sno: index + 1 }));

        setRows(nextRows);
        if (nextRows.length === 0) {
          setLoadError("No withdrawal history found.");
        }
      } catch (error) {
        setRows([]);
        setWithdrawFeeBP(0n);
        setLoadError(
          error?.shortMessage ||
            error?.reason ||
            error?.message ||
            "Failed to load withdrawal history.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <div className="page-container">
      <h1>Withdrawal History</h1>
      <div className="table-wrapper">
        <div className="table-card ">
          {isLoading && <p className="team-loading">Loading withdrawal history...</p>}
          {!isLoading && loadError && <p className="team-loading">{loadError}</p>}
          <CustomTable
            columns={referralColumns}
            rows={rows}
            renderRow={(row) => (
              <>
                <TableCell align="center">{row.sno}</TableCell>
                <TableCell align="center">{row.directAmount}</TableCell>
                <TableCell align="center">{row.selfRoiAmount}</TableCell>
                <TableCell align="center">{row.levelRoiAmount}</TableCell>
                <TableCell align="center">{row.powerAmount}</TableCell>
                <TableCell align="center">{row.rewardAmount}</TableCell>
                <TableCell align="center">{row.usdAmount}</TableCell>
                <TableCell align="center">{row.netUsdAmount}</TableCell>
                <TableCell align="center" className="team-time-cell">
                  {row.time}
                </TableCell>
              </>
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default WithdrawalHistory;
