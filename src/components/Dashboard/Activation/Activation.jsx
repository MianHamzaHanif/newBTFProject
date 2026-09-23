import { TableCell } from "@mui/material";
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import V2PackageManagerABI from "../../../blockchain/v2PackageManagerABI";
import { PackageManagerAddress } from "../../../blockchain/address";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import "../styles/style.css";

const formatUsdt = (value) => {
  try {
    return Number(ethers.formatEther(value || 0n)).toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    });
  } catch {
    return "0.0000";
  }
};

export const Activation = () => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const loadV2Activation = async () => {
      if (!ethers.isAddress(PackageManagerAddress)) {
        setMessage("V2 PackageManager address is not configured.");
        return;
      }

      try {
        setIsLoading(true);
        setMessage("");
        const user = await getReadWalletAddress();
        if (!ethers.isAddress(user)) {
          setRows([]);
          setMessage("Please connect your wallet.");
          return;
        }

        const provider = createBscReadProvider();
        const packageManager = new ethers.Contract(
          PackageManagerAddress,
          V2PackageManagerABI,
          provider
        );
        const [currentPackage, totalPackages, totalSpent, roiPrincipal, roiMaximum, roiGenerated, pendingRoi, roiDay, totalIncomeLimit] =
          await Promise.all([
            packageManager.currentPackage(user),
            packageManager.totalPackageValue(user),
            packageManager.totalUsdtSpent(user),
            packageManager.selfRoiPrincipal(user),
            packageManager.selfRoiMaximum(user),
            packageManager.selfRoiGenerated(user),
            packageManager.pendingSelfRoi(user),
            packageManager.ROI_DAY(),
            packageManager.totalIncomeLimit(user)
          ]);

        if (totalPackages === 0n) {
          setRows([]);
          setSummary(null);
          setMessage("No V2 package has been purchased yet.");
          return;
        }

        const historyLength = Number(await packageManager.getPackageHistoryLength(user));
        const rowsWithTime = await Promise.all(
          Array.from({ length: historyLength }, async (_, index) => {
            const record = await packageManager.getPackageHistoryAt(user, index);
            const replacedByNewerPackage = !record.active && index < historyLength - 1;
            return {
              sno: index + 1,
              packageAmount: formatUsdt(record.amount),
              purchasedAt: new Date(Number(record.purchasedAt) * 1000).toLocaleString(),
              roiGenerated: formatUsdt(record.roiGenerated),
              roiMaximum: formatUsdt(record.roiMaximum),
              status: record.active
                ? "Active - ROI Running"
                : replacedByNewerPackage
                  ? "Inactive - Newer Package Purchased"
                  : "Inactive - Package Limit Completed",
              roiStatus: record.active ? "Yes" : "No"
            };
          })
        );
        /* Legacy event-log history is intentionally disabled. Public BSC
           Testnet RPC nodes can reject eth_getLogs with coalesce errors. */
        /*
        let unusedRowsWithTime;
        try {
        const deploymentBlock = Number(V2DeploymentBlock || 0);
        const events = await packageManager.queryFilter(
          packageManager.filters.PackagePurchased(user),
          deploymentBlock || 0,
          "latest"
        );
        rowsWithTime = await Promise.all(events.map(async (event, index) => {
          const block = await provider.getBlock(event.blockNumber);
          const isCurrent = index === events.length - 1 && currentPackage !== 0n;
          return {
            sno: index + 1,
            packageAmount: formatUsdt(event.args.amount),
            purchasedAt: block ? new Date(Number(block.timestamp) * 1000).toLocaleString() : "-",
            status: isCurrent ? "Active — ROI Running" : "Inactive / Completed",
            roiStatus: isCurrent ? "Yes" : "No"
          };
        }));
        } catch {
          rowsWithTime = [{
            sno: 1,
            packageAmount: formatUsdt(totalPackages),
            purchasedAt: "History temporarily unavailable",
            status: currentPackage !== 0n ? "Active - ROI Running" : "Inactive / Completed",
            roiStatus: currentPackage !== 0n ? "Yes" : "No"
          }];
        }

        */
        setSummary({
          roiPrincipal: formatUsdt(roiPrincipal),
          currentPackage: formatUsdt(currentPackage),
          totalPackages: formatUsdt(totalPackages),
          totalSpent: formatUsdt(totalSpent),
          roiMaximum: formatUsdt(roiMaximum),
          roiGenerated: formatUsdt(roiGenerated),
          pendingRoi: formatUsdt(pendingRoi),
          totalIncomeLimit: formatUsdt(totalIncomeLimit),
          roiDay: `${Number(roiDay) / 60} minutes`
        });
        setRows(rowsWithTime);
      } catch (error) {
        setRows([]);
        setSummary(null);
        setMessage(error?.shortMessage || "Unable to load V2 activation details.");
      } finally {
        setIsLoading(false);
      }
    };

    loadV2Activation();
  }, []);

  const columns = [
    { id: "sno", label: "S. No", sortable: true },
    { id: "packageAmount", label: "Package Amount", sortable: true },
    { id: "purchasedAt", label: "Purchased At", sortable: true },
    { id: "roiMaximum", label: "Self ROI 3x Limit", sortable: true },
    { id: "status", label: "Package Status", sortable: true },
    { id: "roiStatus", label: "Self ROI Active", sortable: true }
  ];

  return (
    <div className="page-container">
      <h1>Activation Package</h1>
      {summary && (
        <div className="withdrawal-grid mb-4">
          <div className="withdrawal-card">
            <p className="withdrawal-card-title">Total Amount Receiving Self ROI</p>
            <h4 className="withdrawal-card-value">{summary.roiPrincipal}</h4>
          </div>
          <div className="withdrawal-card">
            <p className="withdrawal-card-title">Total Packages (Active + Inactive)</p>
            <h4 className="withdrawal-card-value">{summary.totalPackages}</h4>
          </div>
          <div className="withdrawal-card">
            <p className="withdrawal-card-title">Self ROI Claimable</p>
            <h4 className="withdrawal-card-value">{summary.pendingRoi}</h4>
          </div>
          <div className="withdrawal-card">
            <p className="withdrawal-card-title">Self ROI 3x Limit</p>
            <h4 className="withdrawal-card-value">{summary.roiMaximum}</h4>
          </div>
          <div className="withdrawal-card">
            <p className="withdrawal-card-title">Overall Income Claim Limit</p>
            <h4 className="withdrawal-card-value">{summary.totalIncomeLimit}</h4>
          </div>
          <div className="withdrawal-card">
            <p className="withdrawal-card-title">ROI Day</p>
            <h4 className="withdrawal-card-value">{summary.roiDay}</h4>
          </div>
        </div>
      )}
      <div className="table-wrapper">
        <div className="table-card">
          {isLoading && <p className="team-loading">Loading V2 package details...</p>}
          {message && <p className="team-loading">{message}</p>}
          <CustomTable
            columns={columns}
            rows={rows}
            renderRow={(row) => (
              <>
                <TableCell align="center">{row.sno}</TableCell>
                <TableCell align="center">{row.packageAmount}</TableCell>
                <TableCell align="center">{row.purchasedAt}</TableCell>
                <TableCell align="center">{row.roiMaximum}</TableCell>
                <TableCell align="center">{row.status}</TableCell>
                <TableCell align="center">{row.roiStatus}</TableCell>
              </>
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default Activation;
