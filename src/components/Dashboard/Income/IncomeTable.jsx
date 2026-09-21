import { TableCell } from "@mui/material";
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import ReferralNetworkABI from "../../../blockchain/referralNetworkABI.json";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import { ReferralNetworkAddress } from "../../../blockchain/address";
import "../styles/style.css";

const formatAddressShort = (address) => {
  if (!address) {
    return "-";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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

const IncomeTable = ({ incomeType, heading, topContent = null, bottomContent = null }) => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);


  // Details

  const referralColumns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "source", label: "Source Address", sortable: true },
    { id: "amount", label: "Amount", sortable: true },
    { id: "timestamp", label: "Time", sortable: true },
  ];

  useEffect(() => {
    const fetchIncomeRows = async () => {
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

        const nextRows = [];

        const pushRecord = (record) => {
          nextRows.push({
            sno: nextRows.length + 1,
            source:
              (record?.source ?? record?.[2] ?? "").toLowerCase() === ZERO_ADDRESS
                ? walletAddress
                : record?.source ?? record?.[2],
            amount: formatEther4(record?.amount ?? record?.[1] ?? 0n),
            timestamp: formatTimestamp(record?.timestamp ?? record?.[3]),
          });
        };

        const pushRecordIfMatched = (record) => {
          const recordType = Number(record?.incomeType ?? record?.[1] ?? -1);
          const recordUser = (record?.user ?? record?.[0] ?? "").toLowerCase();

          if (recordType !== incomeType) {
            return;
          }

          if (recordUser && recordUser !== walletAddress.toLowerCase()) {
            return;
          }

          nextRows.push({
            sno: nextRows.length + 1,
            source:
              (record?.source ?? record?.[3] ?? "").toLowerCase() === ZERO_ADDRESS
                ? walletAddress
                : record?.source ?? record?.[3],
            amount: formatEther4(record?.amount ?? record?.[2] ?? 0n),
            timestamp: formatTimestamp(record?.timestamp ?? record?.[4]),
          });
        };

        let usedUserScopedCalls = false;
        try {
          const userLength =
            await referralContract.getUserIncomeWithdrawRecordsLengthByType(
              walletAddress,
              incomeType,
            );
          const recordLength = Number(userLength);

          for (let index = recordLength - 1; index >= 0; index -= 1) {
            const record = await referralContract.getUserIncomeWithdrawRecordAtByType(
              walletAddress,
              incomeType,
              index,
            );
            pushRecord(record);
          }

          usedUserScopedCalls = true;
        } catch {
          usedUserScopedCalls = false;
        }

        if (!usedUserScopedCalls) {
          try {
            const userLength = await referralContract.getUserIncomeWithdrawRecordsLength(
              walletAddress,
            );
            const recordLength = Number(userLength);

            for (let index = recordLength - 1; index >= 0; index -= 1) {
              const record = await referralContract.getUserIncomeWithdrawRecordAt(
                walletAddress,
                index,
              );
              pushRecordIfMatched(record);
            }

            usedUserScopedCalls = true;
          } catch {
            usedUserScopedCalls = false;
          }
        }

        if (!usedUserScopedCalls) {
          const totalLength = await referralContract.getIncomeWithdrawRecordsLength();
          const recordLength = Number(totalLength);

          for (let index = recordLength - 1; index >= 0; index -= 1) {
            const record = await referralContract.getIncomeWithdrawRecordAt(index);
            pushRecordIfMatched(record);
          }
        }

        setRows(nextRows);
      } catch {
        setRows([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIncomeRows();
  }, [incomeType]);

  return (
    <div className="page-container">
      <h1>{heading}</h1>
      <div className="table-wrapper">
        <div className="table-card ">
          {isLoading && <p className="team-loading">Loading income data...</p>}
          {topContent}
          <CustomTable
            columns={referralColumns}
            rows={rows}
            renderRow={(row) => (
              <>
                <TableCell align="center">{row.sno}</TableCell>
                <TableCell align="center">{formatAddressShort(row.source)}</TableCell>
                <TableCell align="center">{row.amount}</TableCell>
                <TableCell align="center" className="team-time-cell">
                  {row.timestamp}
                </TableCell>
              </>
            )}
          />
          {bottomContent}
        </div>
      </div>
    </div>
  );
};

export default IncomeTable;
