import { useMemo, useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridSortModel } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import SearchIcon from '@mui/icons-material/Search';
import type { Position } from '../types/positions';

type PositionsTableProps = {
  positions: Position[];
};

type StatusFilter = 'all' | 'buy' | 'sell';
type TypeFilter = 'all' | 'stock' | 'crypto';

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB');
};

const columns: GridColDef[] = [
  {
    field: 'ticker_symbol',
    headerName: 'Ticker',
    flex: 0.8,
    sortable: false,
  },
  {
    field: 'asset_name',
    headerName: 'Asset',
    flex: 1.5,
    sortable: false,
  },
  {
    field: 'quantity',
    headerName: 'Quantity',
    flex: 0.8,
    align: 'right',
    headerAlign: 'right',
    sortable: false,
  },
  {
    field: 'price',
    headerName: 'Price',
    flex: 0.8,
    align: 'right',
    headerAlign: 'right',
    sortable: true,
    valueFormatter: (value: number) => `$${value.toFixed(2)}`,
  },
  {
    field: 'buy_date',
    headerName: 'Buy Date',
    flex: 1,
    sortable: true,
    valueFormatter: (value: string) => formatDate(value),
  },
  {
    field: 'currency',
    headerName: 'Currency',
    flex: 0.6,
    sortable: false,
  },
  {
    field: 'status',
    headerName: 'Status',
    flex: 0.6,
    sortable: false,
    valueFormatter: (value: string) =>
      value ? value.charAt(0).toUpperCase() + value.slice(1) : '-',
  },
];

const PositionsTable = ({ positions }: PositionsTableProps) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'buy_date', sort: 'desc' },
  ]);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

  const filtered = useMemo(() => {
    return positions.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (typeFilter !== 'all' && p.transaction_type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !p.ticker_symbol.toLowerCase().includes(q) &&
          !p.asset_name.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [positions, statusFilter, typeFilter, search]);

  return (
    <Box sx={{ bgcolor: 'white', borderRadius: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {/* Filters bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <TextField
          size="small"
          placeholder="Search ticker or asset…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ minWidth: 220 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        {/* Status filter */}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={statusFilter}
          onChange={(_, val) => { if (val !== null) setStatusFilter(val); }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="buy">Buy</ToggleButton>
          <ToggleButton value="sell">Sell</ToggleButton>
        </ToggleButtonGroup>

        {/* Type filter */}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={typeFilter}
          onChange={(_, val) => { if (val !== null) setTypeFilter(val); }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="stock">Stocks</ToggleButton>
          <ToggleButton value="crypto">Crypto</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* DataGrid */}
      <DataGrid
        rows={filtered}
        columns={columns}
        sortModel={sortModel}
        onSortModelChange={setSortModel}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[10, 25, 50]}
        disableRowSelectionOnClick
        disableColumnMenu
        autoHeight
        sx={{
          border: 'none',
          '& .MuiDataGrid-columnHeaders': {
            bgcolor: 'grey.50',
            borderBottom: '1px solid',
            borderColor: 'divider',
          },
          '& .MuiDataGrid-cell': {
            borderColor: 'divider',
          },
          '& .MuiDataGrid-row:hover': {
            bgcolor: 'grey.50',
          },
          '& .MuiDataGrid-footerContainer': {
            borderTop: '1px solid',
            borderColor: 'divider',
          },
        }}
      />
    </Box>
  );
};

export default PositionsTable;