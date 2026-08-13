import { useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CallMadeIcon from '@mui/icons-material/CallMade';
import SouthEastIcon from '@mui/icons-material/SouthEast';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { Currency, PositionStatus, TransactionType } from '../types/positions';
import type { Position } from '../types/positions';

type PositionsTableProps = {
  positions: Position[];
  onEdit: (position: Position) => void;
  onDelete: (position: Position) => void;
};

type StatusFilter = 'all' | 'buy' | 'sell';
type TypeFilter = 'all' | 'stock' | 'crypto' | 'bvb';

const PAGE_SIZE = 10;

const primaryTextSx = {
  color: '#393a36',
  fontFamily: '"Open Sans", sans-serif',
};

const secondaryTextSx = {
  color: '#61615e',
  fontFamily: '"Open Sans", sans-serif',
};

const mutedTextSx = {
  color: '#9a9a96',
  fontFamily: '"Open Sans", sans-serif',
};

type FilterOption<T extends string> = {
  label: string;
  value: T;
  icon?: ReactNode;
};

const STATUS_OPTIONS: FilterOption<StatusFilter>[] = [
  { label: 'All', value: 'all' },
  { label: 'Buy', value: 'buy', icon: <ArrowUpwardIcon /> },
  { label: 'Sell', value: 'sell', icon: <ArrowDownwardIcon /> },
];

const TYPE_OPTIONS: FilterOption<TypeFilter>[] = [
  { label: 'All', value: 'all' },
  { label: 'Stocks', value: 'stock', icon: <ShowChartIcon /> },
  { label: 'Crypto', value: 'crypto', icon: <CurrencyBitcoinIcon /> },
  { label: 'BVB', value: 'bvb', icon: <AccountBalanceIcon /> },
];

const formatPrice = (price: number, currency: Currency) => {
  const amount = price.toFixed(2);
  return currency === Currency.RON ? `${amount} RON` : `$${amount}`;
};

const matchesTypeFilter = (position: Position, typeFilter: TypeFilter) => {
  if (typeFilter === 'all') return true;
  if (typeFilter === 'stock') {
    return position.transaction_type === TransactionType.Stock && position.currency === Currency.USD;
  }
  if (typeFilter === 'crypto') return position.transaction_type === TransactionType.Crypto;
  return position.currency === Currency.RON;
};

function getPageItems(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 5) {
    return Array.from({ length: total }, (_, index) => index);
  }

  if (current <= 2) {
    return [0, 1, 2, 'ellipsis', total - 1];
  }

  if (current >= total - 3) {
    return [0, 'ellipsis', total - 3, total - 2, total - 1];
  }

  return [0, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total - 1];
}

const navButtonSx = {
  width: 32,
  height: 32,
  borderRadius: '8px',
  bgcolor: 'white',
  color: '#111827',
  border: '1px solid #111827',
  '&.Mui-disabled': {
    bgcolor: '#F3F4F6',
    color: '#D1D5DB',
    borderColor: 'transparent',
  },
  '&:hover': { bgcolor: '#F9FAFB' },
};

function FilterPills<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: FilterOption<T>[];
  ariaLabel: string;
}) {
  return (
    <Box
      role="group"
      aria-label={ariaLabel}
      sx={{
        display: 'flex',
        flex: options.length,
        minWidth: 0,
        gap: { xs: 0.5, sm: 0.75 },
        flexWrap: 'nowrap',
      }}
    >
      {options.map((option) => {
        const selected = value === option.value;
        const button = (
          <ButtonBase
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-label={option.label}
            aria-pressed={selected}
            sx={{
              flex: 1,
              minWidth: 0,
              height: { xs: 40, sm: 44 },
              px: { xs: 0.75, sm: 1.5 },
              borderRadius: '10px',
              bgcolor: selected ? '#111827' : '#F3F4F6',
              color: selected ? '#fff' : '#393a36',
              fontFamily: '"Open Sans", sans-serif',
              fontSize: { xs: 12, sm: 13 },
              fontWeight: 600,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              transition: 'background-color 0.15s ease, color 0.15s ease',
              '& .MuiSvgIcon-root': { fontSize: { xs: 20, sm: 22 } },
              '&:hover': {
                bgcolor: selected ? '#111827' : '#E5E7EB',
              },
            }}
          >
            {option.icon ?? option.label}
          </ButtonBase>
        );

        return option.icon ? (
          <Tooltip key={option.value} title={option.label}>
            {button}
          </Tooltip>
        ) : (
          button
        );
      })}
    </Box>
  );
}

const PositionsTable = ({ positions, onEdit, onDelete }: PositionsTableProps) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return positions
      .filter((position) => {
        if (statusFilter !== 'all' && position.status !== statusFilter) return false;
        if (!matchesTypeFilter(position, typeFilter)) return false;
        if (!query) return true;
        return (
          position.ticker_symbol.toLowerCase().includes(query) ||
          position.asset_name.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => new Date(b.buy_date).getTime() - new Date(a.buy_date).getTime());
  }, [positions, statusFilter, typeFilter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const pageItems = getPageItems(safePage, pageCount);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(0);
  };

  const handleTypeChange = (value: TypeFilter) => {
    setTypeFilter(value);
    setPage(0);
  };

  return (
    <Box
      sx={{
        bgcolor: 'white',
        borderRadius: '16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        px: { xs: 2, sm: 2.5 },
        py: { xs: 2, sm: 2.5 },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 1 }}>
        <TextField
          size="small"
          placeholder="Search ticker or asset"
          value={search}
          onChange={(event) => handleSearchChange(event.target.value)}
          fullWidth
          inputProps={{
            enterKeyHint: 'search',
            autoComplete: 'off',
            autoCorrect: 'off',
            autoCapitalize: 'none',
            spellCheck: 'false',
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#9CA3AF', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          onFocus={() => {
            // iOS pans/zooms the visual viewport around a focused input.
            window.scrollTo(0, 0);
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: '#F3F4F6',
              borderRadius: '12px',
              boxShadow: 'none',
              WebkitTapHighlightColor: 'transparent',
              '& fieldset': { border: 'none' },
              '&:hover fieldset': { border: 'none' },
              '&.Mui-focused': {
                boxShadow: 'none',
              },
              '&.Mui-focused fieldset': { border: 'none' },
            },
            '& .MuiInputBase-input': {
              py: 1.25,
              fontFamily: '"Open Sans", sans-serif',
              // iOS zooms (and shifts the layout) when focused inputs are under 16px.
              fontSize: 16,
              color: '#393a36',
              outline: 'none',
              WebkitAppearance: 'none',
              '&:focus': { outline: 'none' },
              '&::placeholder': { color: '#9a9a96', opacity: 1 },
            },
          }}
        />

        <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 2 }, flexWrap: 'nowrap', width: '100%' }}>
          <FilterPills
            ariaLabel="Filter by action"
            value={statusFilter}
            onChange={handleStatusChange}
            options={STATUS_OPTIONS}
          />
          <FilterPills
            ariaLabel="Filter by asset type"
            value={typeFilter}
            onChange={handleTypeChange}
            options={TYPE_OPTIONS}
          />
        </Box>
      </Box>

      {paged.length === 0 ? (
        <Typography
          sx={{
            ...secondaryTextSx,
            fontSize: 16,
            lineHeight: '20px',
            py: 4,
            textAlign: 'center',
          }}
        >
          No matching transactions.
        </Typography>
      ) : (
        <Box>
          {paged.map((position) => {
            const isBuy = position.status === PositionStatus.Buy;
            return (
              <Box
                key={position.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  py: 1.75,
                  borderBottom: '1px solid',
                  borderColor: '#F0F0F0',
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: isBuy ? '#E7F6EE' : '#FDECEC',
                    color: isBuy ? '#1B7A4A' : '#B42318',
                  }}
                >
                  {isBuy ? (
                    <CallMadeIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <SouthEastIcon sx={{ fontSize: 18 }} />
                  )}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    fontWeight={700}
                    sx={{
                      ...primaryTextSx,
                      fontSize: 15,
                      lineHeight: '18px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {position.ticker_symbol}
                  </Typography>
                  <Typography
                    sx={{
                      ...mutedTextSx,
                      fontSize: 12,
                      lineHeight: '14px',
                      mt: 0.25,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {position.asset_name}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    flexShrink: 0,
                    textAlign: 'right',
                    px: { xs: 0.5, sm: 2 },
                  }}
                >
                  <Typography
                    fontWeight={600}
                    sx={{
                      ...primaryTextSx,
                      fontSize: 14,
                      lineHeight: '18px',
                      whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatPrice(position.price, position.currency)}
                  </Typography>
                  <Typography
                    sx={{
                      ...mutedTextSx,
                      fontSize: 12,
                      lineHeight: '14px',
                      mt: 0.25,
                      whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {position.quantity}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: 1.5 }}>
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => onEdit(position)}
                      aria-label={`Edit ${position.ticker_symbol}`}
                      sx={{ color: '#9CA3AF' }}
                    >
                      <EditNoteOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={() => onDelete(position)}
                      aria-label={`Delete ${position.ticker_symbol}`}
                      sx={{ color: '#D95D39' }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          pt: 2,
          flexWrap: 'wrap',
        }}
      >
        <Typography sx={{ ...mutedTextSx, fontSize: 12, lineHeight: '14px' }}>
          Page {safePage + 1} of {pageCount}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <IconButton
            size="small"
            onClick={() => setPage(safePage - 1)}
            disabled={safePage === 0}
            aria-label="Previous page"
            sx={navButtonSx}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>

          {pageItems.map((item, index) =>
            item === 'ellipsis' ? (
              <Typography
                key={`ellipsis-${index}`}
                sx={{ ...mutedTextSx, px: 0.5, fontSize: 13, lineHeight: 1 }}
              >
                ...
              </Typography>
            ) : (
              <ButtonBase
                key={item}
                onClick={() => setPage(item)}
                aria-label={`Page ${item + 1}`}
                aria-current={item === safePage ? 'page' : undefined}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  fontFamily: '"Open Sans", sans-serif',
                  fontSize: 13,
                  fontWeight: item === safePage ? 700 : 500,
                  bgcolor: item === safePage ? '#111827' : 'transparent',
                  color: item === safePage ? '#fff' : '#61615e',
                  '&:hover': {
                    bgcolor: item === safePage ? '#111827' : 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                {item + 1}
              </ButtonBase>
            ),
          )}

          <IconButton
            size="small"
            onClick={() => setPage(safePage + 1)}
            disabled={safePage >= pageCount - 1}
            aria-label="Next page"
            sx={navButtonSx}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

export default PositionsTable;
