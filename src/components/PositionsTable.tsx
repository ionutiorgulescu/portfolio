import { useEffect, useMemo, useState } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from '@mui/material';
import type { Position } from '../types/positions';

type PositionsTableProps = {
  positions: Position[];
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
};

const formatStatus = (value: string) => {
  if (!value) return '-';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const PositionsTable = ({ positions }: PositionsTableProps) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const visiblePositions = useMemo(() => {
    const start = page * rowsPerPage;
    return positions.slice(start, start + rowsPerPage);
  }, [page, positions, rowsPerPage]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(positions.length / rowsPerPage) - 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, positions.length, rowsPerPage]);

  const handleChangePage = (_event: unknown, nextPage: number) => {
    setPage(nextPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(Number(event.target.value));
    setPage(0);
  };

  return (
    <TableContainer component={Paper}>
      <Table aria-label="positions table">
        <TableHead>
          <TableRow>
            <TableCell>Ticker</TableCell>
            <TableCell>Asset</TableCell>
            <TableCell align="right">Quantity</TableCell>
            <TableCell align="right">Buy Price</TableCell>
            <TableCell>Buy Date</TableCell>
            <TableCell>Currency</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visiblePositions.map((position) => (
            <TableRow key={position.id} hover>
              <TableCell>{position.ticker_symbol}</TableCell>
              <TableCell>{position.asset_name}</TableCell>
              <TableCell align="right">{position.quantity}</TableCell>
              <TableCell align="right">{position.price.toFixed(2)}</TableCell>
              <TableCell>{formatDate(position.buy_date)}</TableCell>
              <TableCell>{position.currency}</TableCell>
              <TableCell>{formatStatus(position.status)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        component="div"
        count={positions.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 25, 50]}
      />
    </TableContainer>
  );
};

export default PositionsTable;
