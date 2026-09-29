import { TableCell } from "@mui/material";
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import CustomTable from "../CommonComponents/CustomTable";
import PackageManagerABI from "../../../blockchain/packageMangerABI.json";
import V2PackageManagerABI from "../../../blockchain/v2PackageManagerABI";
import { PackageManagerAddress } from "../../../blockchain/address";
import { createBscReadProvider, getReadWalletAddress } from "../../../blockchain/readProvider";
import { V1_MAINNET } from "../../../blockchain/v1MainnetConfig";
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

const incomeLimitForPackage = (amount) => {
  const packageAmount = BigInt(amount ?? 0n);
  if (packageAmount === ethers.parseEther("25")) return ethers.parseEther("75");
  if (packageAmount === ethers.parseEther("100")) return ethers.parseEther("500");
  if (packageAmount === ethers.parseEther("500")) return ethers.parseEther("3500");
  if (packageAmount === ethers.parseEther("1000")) return ethers.parseEther("10000");
  return 0n;
};

const percent = (numerator, denominator) => {
  const top = BigInt(numerator ?? 0n);
  const bottom = BigInt(denominator ?? 0n);
  if (bottom <= 0n) return "0.00";
  return (Number((top * 10000n) / bottom) / 100).toFixed(2);
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

        const loadV1Activation = async () => {
          const v1Provider = new ethers.JsonRpcProvider(
            V1_MAINNET.rpcUrl, V1_MAINNET.chainId, { staticNetwork: true },
          );
          const v1Manager = new ethers.Contract(
            V1_MAINNET.packageManager,
            PackageManagerABI,
            v1Provider,
          );
          const [lengthRaw, oneDayRaw] = await Promise.all([
            v1Manager.getStakeHistoryLength(user),
            v1Manager.oneDay(),
          ]);
          const historyLength = Number(lengthRaw ?? 0n);
          if (historyLength === 0) {
            setRows([]);
            setSummary(null);
            setMessage("No V1 or V2 package has been purchased yet.");
            return;
          }

          const legacyPackages = await Promise.all(
            Array.from({ length: historyLength }, async (_, index) => {
              const [stake, roi] = await Promise.all([
                v1Manager.userStakeHistory(user, index),
                v1Manager.getStakeRoiInfo(user, index),
              ]);
              return { stake, roi };
            }),
          );
          const totalPackageValue = legacyPackages.reduce(
            (total, { stake }) => total + BigInt(stake?.packageValue ?? stake?.[0] ?? 0n),
            0n,
          );
          const activePackages = legacyPackages.filter(({ roi }) => {
            const maxRoi = BigInt(roi?.maxRoi ?? roi?.[1] ?? 0n);
            const totalAccrued = BigInt(roi?.totalAccrued ?? roi?.[2] ?? 0n);
            return maxRoi > 0n && totalAccrued < maxRoi;
          });
          const sum = (entries, read) => entries.reduce((total, entry) => total + read(entry), 0n);
          const principal = sum(activePackages, ({ roi }) => BigInt(roi?.principal ?? roi?.[0] ?? 0n));
          const maximum = sum(activePackages, ({ roi }) => BigInt(roi?.maxRoi ?? roi?.[1] ?? 0n));
          const generated = sum(activePackages, ({ roi }) => BigInt(roi?.totalAccrued ?? roi?.[2] ?? 0n));
          const claimable = sum(activePackages, ({ roi }) => BigInt(roi?.claimable ?? roi?.[4] ?? 0n));
          const allMaximum = sum(legacyPackages, ({ roi }) => BigInt(roi?.maxRoi ?? roi?.[1] ?? 0n));
          const rowsWithTime = legacyPackages.map(({ stake, roi }, index) => {
            const maxRoi = BigInt(roi?.maxRoi ?? roi?.[1] ?? 0n);
            const totalAccrued = BigInt(roi?.totalAccrued ?? roi?.[2] ?? 0n);
            const active = maxRoi > 0n && totalAccrued < maxRoi;
            return {
              sno: index + 1,
              packageAmount: formatUsdt(stake?.packageValue ?? stake?.[0]),
              purchasedAt: Number(stake?.timestamp ?? stake?.[7] ?? 0n) > 0
                ? new Date(Number(stake?.timestamp ?? stake?.[7]) * 1000).toLocaleString()
                : "-",
              roiMaximum: formatUsdt(maxRoi),
              status: active ? "V1 Active - ROI Running" : "V1 - Self ROI Complete",
              roiStatus: active ? "Yes" : "No",
            };
          });

          setSummary({
            source: "V1",
            totalRoiPackageAmount: formatUsdt(totalPackageValue),
            activePackagesAmount: formatUsdt(principal),
            roiMaximum: formatUsdt(maximum),
            roiGenerated: formatUsdt(generated),
            pendingRoi: formatUsdt(claimable),
            // V1 has its own ROI cap; this is its equivalent plan limit.
            allPackagesIncomeLimit: formatUsdt(allMaximum),
            activePackagesIncomeLimit: formatUsdt(maximum),
            roiProgress: `${percent(generated, maximum)}% / ${percent(maximum, principal)}%`,
            roiDay: `${Number(oneDayRaw ?? 86400n) / 60} minutes`,
          });
          setRows(rowsWithTime);
          setMessage("Showing V1 package data because this wallet has no V2 package yet.");
        };

        const provider = createBscReadProvider();
        const packageManager = new ethers.Contract(
          PackageManagerAddress,
          V2PackageManagerABI,
          provider
        );
        const [currentPackage, totalPackages, totalSpent, roiPrincipal, roiMaximum, roiGenerated, pendingRoi, roiDay] =
          await Promise.all([
            packageManager.currentPackage(user),
            packageManager.totalPackageValue(user),
            packageManager.totalUsdtSpent(user),
            packageManager.selfRoiPrincipal(user),
            packageManager.selfRoiMaximum(user),
            packageManager.selfRoiGenerated(user),
            packageManager.pendingSelfRoi(user),
            packageManager.ROI_DAY()
          ]);

        if (totalPackages === 0n) {
          await loadV1Activation();
          return;
        }

        const historyLength = Number(await packageManager.getPackageHistoryLength(user));
        const packageRecords = await Promise.all(
          Array.from({ length: historyLength }, async (_, index) => {
            return packageManager.getPackageHistoryAt(user, index);
          })
        );
        const allPackagesIncomeLimit = packageRecords.reduce(
          (total, record) => total + incomeLimitForPackage(record.amount),
          0n,
        );
        const activePackagesIncomeLimit = packageRecords.reduce(
          (total, record) => record.active ? total + incomeLimitForPackage(record.amount) : total,
          0n,
        );
        const rowsWithTime = packageRecords.map((record, index) => {
            const replacedByNewerPackage = !record.active && index < historyLength - 1;
            const selfRoiActive = record.active && record.roiGenerated < record.roiMaximum;
            return {
              sno: index + 1,
              packageAmount: formatUsdt(record.amount),
              purchasedAt: new Date(Number(record.purchasedAt) * 1000).toLocaleString(),
              roiGenerated: formatUsdt(record.roiGenerated),
              roiMaximum: formatUsdt(record.roiMaximum),
              status: record.active
                ? selfRoiActive ? "Active - ROI Running" : "Active - Self ROI Complete"
                : replacedByNewerPackage
                  ? "Inactive - Newer Package Purchased"
                  : "Inactive - Package Limit Completed",
              roiStatus: selfRoiActive ? "Yes" : "No"
            };
          });
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
          source: "V2",
          totalRoiPackageAmount: formatUsdt(totalPackages),
          activePackagesAmount: formatUsdt(roiPrincipal),
          totalPackages: formatUsdt(totalPackages),
          totalSpent: formatUsdt(totalSpent),
          roiMaximum: formatUsdt(roiMaximum),
          roiGenerated: formatUsdt(roiGenerated),
          pendingRoi: formatUsdt(pendingRoi),
          allPackagesIncomeLimit: formatUsdt(allPackagesIncomeLimit),
          activePackagesIncomeLimit: formatUsdt(activePackagesIncomeLimit),
          roiProgress: `${percent(roiGenerated, roiMaximum)}% / ${percent(roiMaximum, roiPrincipal)}%`,
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
            <h4 className="withdrawal-card-value">{summary.totalRoiPackageAmount}</h4>
          </div>
          <div className="withdrawal-card">
            <p className="withdrawal-card-title">Active Packages Total</p>
            <h4 className="withdrawal-card-value">{summary.activePackagesAmount}</h4>
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
            <p className="withdrawal-card-title">{summary.source} Self ROI Progress / Target</p>
            <h4 className="withdrawal-card-value">{summary.roiProgress}</h4>
          </div>
          <div className="withdrawal-card">
            <p className="withdrawal-card-title">Overall Income Claim Limit (All Packages)</p>
            <h4 className="withdrawal-card-value">{summary.allPackagesIncomeLimit}</h4>
          </div>
          <div className="withdrawal-card">
            <p className="withdrawal-card-title">Active Income Claim Limit</p>
            <h4 className="withdrawal-card-value">{summary.activePackagesIncomeLimit}</h4>
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
