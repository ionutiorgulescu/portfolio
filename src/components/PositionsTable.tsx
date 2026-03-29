import { useMemo, useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridSortModel, GridRenderCellParams } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useMediaQuery, useTheme } from '@mui/material';
import type { Position } from '../types/positions';

type PositionsTableProps = {
  positions: Position[];
  onEdit: (position: Position) => void;
  onDelete: (position: Position) => void;
};

type StatusFilter = 'all' | 'buy' | 'sell';
type TypeFilter = 'all' | 'stock' | 'crypto';

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB');
};

const PositionsTable = ({ positions, onEdit, onDelete }: PositionsTableProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'buy_date', sort: 'desc' },
  ]);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });

  const columns: GridColDef[] = [
    { field: 'ticker_symbol', headerName: 'Ticker', flex: 1, sortable: false },
    { field: 'asset_name', headerName: 'Asset', flex: 1.5, sortable: false },
    { field: 'quantity', headerName: 'Qty', flex: 0.8, align: 'right', headerAlign: 'right', sortable: false },
    { field: 'price', headerName: 'Price', flex: 1, align: 'right', headerAlign: 'right', sortable: true, valueFormatter: (value: number) => `$${value.toFixed(2)}` },
    { field: 'buy_date', headerName: 'Date', flex: 1, sortable: true, valueFormatter: (value: string) => formatDate(value) },
    { field: 'currency', headerName: 'Currency', flex: 0.8, sortable: false },
    {
      field: 'status',
      headerName: 'Status',
      flex: 0.8,
      sortable: false,
      valueFormatter: (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : '-',
    },
    {
      field: 'actions',
      headerName: '',
      width: 88,
      sortable: false,
      disableColumnMenu: true,
      align: 'right',
      renderCell: (params: GridRenderCellParams<Position>) => (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', width: '100%' }}>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(params.row);
              }}
              aria-label={`Edit ${params.row.ticker_symbol}`}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(params.row);
              }}
              aria-label={`Delete ${params.row.ticker_symbol}`}
              sx={{ color: 'error.main' }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <TextField
          size="small"
          placeholder="Search ticker or asset…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <ToggleButtonGroup size="small" exclusive value={statusFilter} onChange={(_, val) => { if (val !== null) setStatusFilter(val); }}>
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="buy">Buy</ToggleButton>
            <ToggleButton value="sell">Sell</ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup size="small" exclusive value={typeFilter} onChange={(_, val) => { if (val !== null) setTypeFilter(val); }}>
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="stock">Stocks</ToggleButton>
            <ToggleButton value="crypto">Crypto</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

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
        columnVisibilityModel={{
          currency: !isMobile,
          buy_date: !isMobile,
          quantity: !isMobile,
        }}
        sx={{
          border: 'none',
          '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' },
          '& .MuiDataGrid-cell': { borderColor: 'divider' },
          '& .MuiDataGrid-row:hover': { bgcolor: 'grey.50' },
          '& .MuiDataGrid-footerContainer': { borderTop: '1px solid', borderColor: 'divider' },
        }}
      />
    </Box>
  );
};

export default PositionsTable;