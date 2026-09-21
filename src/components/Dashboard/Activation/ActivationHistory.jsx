import { TableCell } from "@mui/material";
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import PackageManagerABI from "../../../blockchain/packageMangerABI.json";
import PackageManagerLensABI from "../../../blockchain/packageManagerLensABI.json";
import ReferralNetworkABI from "../../../blockchain/referralNetworkABI.json";
import { PackageManagerAddress, PackageManagerLensAddress, ReferralNetworkAddress } from "../../../blockchain/address";
import { BSC_MAINNET } from "../../../blockchain/bscMainnetConfig";
import { getReadWalletAddress } from "../../../blockchain/readProvider";
import { formatWallet } from "../../../utils/utils";

const formatToken = (value) => {
  try { return Number(ethers.formatEther(value ?? 0n)).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }); }
  catch { return "0.0000"; }
};

const formatTime = (value) => {
  const timestamp = Number(value ?? 0n);
  return timestamp ? new Date(timestamp * 1000).toLocaleString() : "-";
};

export const ActivationHistory = () => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const columns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "userid", label: "User ID", sortable: true },
    { id: "walletid", label: "Wallet", sortable: true },
    { id: "registrationdate", label: "Registration Date", sortable: true },
    { id: "status", label: "Status", sortable: true },
    { id: "package", label: "Package", sortable: true },
    { id: "activationdate", label: "Activation Date", sortable: true },
  ];

  useEffect(() => {
    const loadHistory = async () => {
      if (!window.ethereum) { setLoadError("Wallet not found."); return; }
      try {
        setIsLoading(true); setLoadError("");
        const walletAddress = await getReadWalletAddress();
        if (!walletAddress || !ethers.isAddress(walletAddress)) {
          setRows([]); setLoadError("Please connect wallet to view activation history."); return;
        }
        const provider = new ethers.JsonRpcProvider(BSC_MAINNET.rpcUrls[1], BSC_MAINNET.chainId, { staticNetwork: true });
        const lens = new ethers.Contract(PackageManagerLensAddress, PackageManagerLensABI, provider);
        const packageManager = new ethers.Contract(PackageManagerAddress, PackageManagerABI, provider);
        const referral = new ethers.Contract(ReferralNetworkAddress, ReferralNetworkABI, provider);
        const [user, lengthRaw] = await Promise.all([referral.users(walletAddress), lens.getStakeHistoryLength(walletAddress)]);
        const length = Number(lengthRaw ?? 0n);
        const nextRows = await Promise.all(Array.from({ length }, async (_, rowIndex) => {
          const index = length - 1 - rowIndex;
          const [stake, roiInfo] = await Promise.all([lens.getStakeHistoryAt(walletAddress, index), packageManager.getStakeRoiInfo(walletAddress, index)]);
          const maxRoi = BigInt(roiInfo?.maxRoi ?? roiInfo?.[1] ?? 0n);
          const accrued = BigInt(roiInfo?.totalAccrued ?? roiInfo?.[2] ?? 0n);
          return {
            sno: rowIndex + 1,
            userid: String(user?.id ?? user?.[0] ?? "-"),
            walletid: walletAddress,
            registrationdate: formatTime(user?.registeredAt ?? user?.[2]),
            status: maxRoi > 0n && accrued >= maxRoi ? "Completed" : "Active",
            package: `${formatToken(stake?.packageValue ?? stake?.[0])} USDT`,
            activationdate: formatTime(stake?.timestamp ?? stake?.[7]),
          };
        }));
        setRows(nextRows);
        if (!nextRows.length) setLoadError("No activation packages found.");
      } catch (error) {
        setRows([]); setLoadError(error?.shortMessage || error?.reason || "Failed to load activation history.");
      } finally { setIsLoading(false); }
    };
    loadHistory();
  }, []);

  return <div className="page-container"><h1>Activation History</h1><div className="table-wrapper"><div className="table-card">
    {isLoading && <p className="team-loading">Loading activation history...</p>}
    {!isLoading && loadError && <p className="team-loading">{loadError}</p>}
    <CustomTable columns={columns} rows={rows} renderRow={(row) => <>
      <TableCell align="center">{row.sno}</TableCell><TableCell align="center">{row.userid}</TableCell>
      <TableCell align="center">{formatWallet(row.walletid)}</TableCell><TableCell align="center">{row.registrationdate}</TableCell>
      <TableCell align="center"><span className={`${row.status === "Active" ? "active" : "in-active"} status`}>{row.status}</span></TableCell>
      <TableCell align="center">{row.package}</TableCell><TableCell align="center">{row.activationdate}</TableCell>
    </>} />
  </div></div></div>;
};

export default ActivationHistory;
