import * as React from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
} from "@mui/material";
import { styled } from "@mui/material/styles";

import { visuallyHidden } from "@mui/utils";
// import "../../App.css";
/* SORT HELPERS */
function descendingComparator(a, b, orderBy) {
  if (b[orderBy] < a[orderBy]) return -1;
  if (b[orderBy] > a[orderBy]) return 1;
  return 0;
}

/* Head Row */
const HeadRow = styled(TableRow)({
  "&:hover": {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  background:
    "linear-gradient(135deg, rgba(255, 255, 255, 0.10), rgba(123, 183, 255, 0.06) 45%, rgba(11, 27, 45, 0.22) 100%)",
  borderBottom: "1px solid rgba(194, 225, 255, 0.18)",
});

//  Table Body
const BodyRow = styled(TableRow)({
  backgroundColor: "rgba(255, 255, 255, 0.03)",
  "& td": {
    color: "#fff",
    borderBottom: "1px solid rgba(194, 225, 255, 0.10)",
  },
  "&:hover": {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
});

// Table Cell
const HeadCell = styled(TableCell)({
  color: "#dffff5",
  fontWeight: 700,
});

function getComparator(order, orderBy) {
  return order === "desc"
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

export default function CustomTable({
  columns,
  rows,
  renderRow,
  rowsPerPageOptions = [5, 10, 25, 50],
}) {
  const [order, setOrder] = React.useState("asc");
  const [orderBy, setOrderBy] = React.useState(columns[0]?.id || "");
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(5);

  const handleRequestSort = (_, property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const visibleRows = React.useMemo(
    () =>
      [...rows]
        .sort(getComparator(order, orderBy))
        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [rows, order, orderBy, page, rowsPerPage],
  );

  return (
    <>
      <TableContainer
        sx={{
          background:
            "linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(123, 183, 255, 0.03) 45%, rgba(11, 27, 45, 0.14) 100%)",
          border: "1px solid rgba(194, 225, 255, 0.12)",
          borderRadius: "16px",
          overflowX: "auto",
          overflowY: "hidden",
          width: "100%",
          backdropFilter: "blur(14px)",
        }}
      >
        <Table sx={{ minWidth: "max-content", width: "100%" }}>
          <TableHead>
            <HeadRow className="manrope-fontFamily">
              {columns.map((col) => (
                <HeadCell
                  key={col.id}
                  align="center"
                  sortDirection={orderBy === col.id ? order : false}
                >
                  {col.sortable ? (
                    <TableSortLabel
                      active={orderBy === col.id}
                      direction={orderBy === col.id ? order : "asc"}
                      onClick={(e) => handleRequestSort(e, col.id)}
                      sx={{
                        color: "#00ff99",
                        "&.Mui-active": {
                          color: "#dffff5",
                        },
                        "&:hover": {
                          color: "#dffff5",
                        },
                        "& .MuiTableSortLabel-icon": {
                          color: "#dffff5 !important",
                        },
                      }}
                    >
                      {col.label}
                      {orderBy === col.id && (
                        <Box component="span" sx={visuallyHidden}>
                          sorted
                        </Box>
                      )}
                    </TableSortLabel>
                  ) : (
                    col.label
                  )}
                </HeadCell>
              ))}
            </HeadRow>
          </TableHead>

          <TableBody>
            {visibleRows.length > 0 ? (
              visibleRows.map((row, index) => (
                <BodyRow key={index}>{renderRow(row)}</BodyRow>
              ))
            ) : (
              <BodyRow>
                <TableCell colSpan={columns.length} align="center">
                  No Data Found!
                </TableCell>
              </BodyRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={rowsPerPageOptions}
        component="div"
        count={rows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(+e.target.value);
          setPage(0);
        }}
        sx={{
          color: "#fff", // text
          borderTop: "1px solid rgba(194, 225, 255, 0.10)",
          ".MuiTablePagination-selectLabel": {
            color: "#d2e5f5",
          },
          ".MuiTablePagination-displayedRows": {
            color: "#d2e5f5",
          },
          ".MuiSvgIcon-root": {
            color: "#dffff5",
          },
          ".MuiIconButton-root.Mui-disabled": {
            color: "rgba(255,255,255,0.20)",
          },
        }}
      />
    </>
  );
}
