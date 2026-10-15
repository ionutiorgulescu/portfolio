import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart';
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useCreatePosition } from '../hooks/useCreatePosition';
import {
  usePortfolioComposition,
  type TickerComposition,
} from '../hooks/usePortfolioComposition';
import { useStockLogos } from '../hooks/useStockLogos';
import { useValuesVisibility } from '../contexts/ValuesVisibilityContext';
import { Currency, TransactionType } from '../types/positions';
import type { NewPosition } from '../schemas/positionSchema';
import { isBvbListing } from '../utils/bvbFavicon';
import type { CompositionFilter } from './FilterControl';
import PositionFormModal from './PositionFormModal';
import { PortfolioCompositionRow } from './PortfolioCompositionRaw';
import { color, shadow, textSx } from '../theme/cssVars';

function RowSkeleton() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        columnGap: 1.5,
        py: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Skeleton variant="rounded" width={44} height={44} sx={{ borderRadius: '10px', flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', columnGap: 1.5 }}>
          <Box sx={{ flex: 1 }}>
            <Skeleton width={64} height={18} sx={{ mb: 0.5 }} />
            <Skeleton width="55%" height={16} />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Skeleton width={110} height={18} sx={{ mb: 0.5 }} />
            <Skeleton width={56} height={14} />
          </Box>
        </Box>
        <Skeleton width="70%" height={14} sx={{ mt: 1 }} />
      </Box>
    </Box>
  );
}

type CompositionGroupKey = Exclude<CompositionFilter, 'all'>;

type CompositionGroup = {
  key: CompositionGroupKey;
  label: string;
  icon: ReactNode;
  count: number;
  costBasis: number;
  currentValue: number;
  gainLoss: number;
  weight: number;
};

const GROUP_META: { key: CompositionGroupKey; label: string; icon: ReactNode }[] = [
  { key: 'stock', label: 'Stocks', icon: <ShowChartIcon fontSize="small" /> },
  { key: 'etf', label: 'ETF', icon: <StackedLineChartIcon fontSize="small" /> },
  { key: 'crypto', label: 'Crypto', icon: <CurrencyBitcoinIcon fontSize="small" /> },
  { key: 'bvb', label: 'BVB', icon: <AccountBalanceIcon fontSize="small" /> },
];

function groupKeyFor(row: TickerComposition): CompositionGroupKey {
  if (row.transactionType === TransactionType.Crypto) return 'crypto';
  if (row.currency === Currency.RON) return 'bvb';
  if (row.transactionType === TransactionType.Etf) return 'etf';
  return 'stock';
}

/** Rolls the 'all' composition (values already in USD) up into Stocks / ETF / Crypto / BVB. */
function buildGroups(rows: TickerComposition[]): CompositionGroup[] {
  const groups = GROUP_META.map((meta) => {
    const members = rows.filter((row) => groupKeyFor(row) === meta.key);
    const costBasis = members.reduce((sum, row) => sum + row.costBasis, 0);
    const currentValue = members.reduce((sum, row) => sum + row.currentValue, 0);
    return {
      ...meta,
      count: members.length,
      costBasis,
      currentValue,
      gainLoss: currentValue - costBasis,
      weight: members.reduce((sum, row) => sum + row.weight, 0),
    };
  });
  return groups.filter((group) => group.count > 0).sort((a, b) => b.weight - a.weight);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function CompositionGroupRow({
  group,
  showPercent,
  onTogglePercent,
  onSelect,
}: {
  group: CompositionGroup;
  showPercent: boolean;
  onTogglePercent: () => void;
  onSelect?: (key: CompositionGroupKey) => void;
}) {
  const { valuesHidden } = useValuesVisibility();
  const gainPositive = group.gainLoss >= 0;
  const gainLossPercent = group.costBasis !== 0 ? (group.gainLoss / group.costBasis) * 100 : 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        columnGap: 1.5,
        py: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <ButtonBase
        onClick={onSelect ? () => onSelect(group.key) : undefined}
        disabled={!onSelect}
        aria-label={`Show ${group.label} positions`}
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          columnGap: 1.5,
          textAlign: 'left',
          borderRadius: '10px',
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '10px',
            bgcolor: color.bgLogo,
            border: '1px solid',
            borderColor: color.borderLogo,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: color.textSubtle,
          }}
        >
          {group.icon}
        </Box>
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', rowGap: '2px' }}>
          <Typography fontWeight={700} sx={{ ...primaryTextSx, fontSize: 15, lineHeight: '18px' }}>
            {group.label}
          </Typography>
          <Typography sx={{ ...secondaryTextSx, fontSize: 13, fontWeight: 600, lineHeight: '18px' }}>
            {valuesHidden ? '••••' : formatUsd(group.currentValue)}
          </Typography>
          <Typography sx={{ ...secondaryTextSx, fontSize: 12, lineHeight: '14px' }}>
            {group.count} {group.count === 1 ? 'position' : 'positions'}
          </Typography>
        </Box>
      </ButtonBase>

      <Box
        onClick={onTogglePercent}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          rowGap: '2px',
          flexShrink: 0,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {valuesHidden ? (
          <LockOutlinedIcon sx={{ fontSize: 18, color: color.textSubtle }} />
        ) : (
          <Typography
            fontWeight={600}
            sx={{
              fontFamily: '"Open Sans", sans-serif',
              fontSize: 14,
              lineHeight: '18px',
              color: gainPositive ? color.gain : color.loss,
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {gainPositive ? '↑' : '↓'}{' '}
            {showPercent
              ? `${gainPositive ? '+' : ''}${gainLossPercent.toFixed(2)}%`
              : `${gainPositive ? '+' : ''}${formatUsd(group.gainLoss)}`}
          </Typography>
        )}
        <Typography
          sx={{
            ...secondaryTextSx,
            fontSize: 12,
            lineHeight: '14px',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {group.weight.toFixed(2)}%
        </Typography>
      </Box>
    </Box>
  );
}

type PortfolioCompositionProps = {
  filter: CompositionFilter;
  portfolioId: string;
  /** Lets the grouped 'All' view drill into a single filter. */
  onFilterChange?: (filter: CompositionFilter) => void;
};

const primaryTextSx = textSx.primary;

const TitleSx = {
  fontSize: { xs: 16, sm: 18, md: 20 },
  lineHeight: { xs: '24px', sm: '26px', md: '28px' },
  color: color.textPrimary,
  fontWeight: 600,
};

const secondaryTextSx = textSx.secondary;

export function PortfolioComposition({ filter, portfolioId, onFilterChange }: PortfolioCompositionProps) {
  const queryClient = useQueryClient();
  const { composition, tickers, loading, error } = usePortfolioComposition(filter, portfolioId);
  // The grouped 'All' view has no per-ticker rows, so it needs no logos.
  const { logosByTicker, loading: logosLoading } = useStockLogos(
    filter === 'all' ? [] : tickers.filter((ticker) => !isBvbListing(ticker)),
  );
  const createPositionMutation = useCreatePosition(portfolioId);
  const currency = filter === 'bvb' ? 'RON' : 'USD';
  const [showPercent, setShowPercent] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<TickerComposition | null>(null);

  const handleLogoClick = (row: TickerComposition) => {
    setSelectedRow(row);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedRow(null);
  };

  const handleFormSubmit = async (data: NewPosition) => {
    await createPositionMutation.mutateAsync(data);
    handleCloseForm();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['positions', portfolioId] }),
      queryClient.invalidateQueries({ queryKey: ['compositionQuotes'] }),
      queryClient.invalidateQueries({ queryKey: ['portfolioQuotes'] }),
      queryClient.invalidateQueries({ queryKey: ['performanceQuotes'] }),
    ]);
  };

  if (error) return <Alert severity="error">{error.message}</Alert>;

  // Wait for logo URLs (React Query cache or edge function) before painting rows.
  const showRowsLoading = loading || logosLoading;

  return (
    <Box sx={{ bgcolor: color.bgSurface, borderRadius: '16px', p: 3, boxShadow: shadow.card }}>
      <Typography
        sx={{
          ...primaryTextSx,
          ...TitleSx,
          mb: 1,
        }}
      >
        Composition
      </Typography>

      {showRowsLoading ? (
        [...Array(filter === 'all' ? 3 : 8)].map((_, i) => <RowSkeleton key={i} />)
      ) : composition.length === 0 ? (
        <Typography
          sx={{
            ...secondaryTextSx,
            fontSize: 16,
            lineHeight: '20px',
            py: 4,
            textAlign: 'center',
          }}
        >
          No positions found.
        </Typography>
      ) : filter === 'all' ? (
        buildGroups(composition).map(group => (
          <CompositionGroupRow
            key={group.key}
            group={group}
            showPercent={showPercent}
            onTogglePercent={() => setShowPercent(prev => !prev)}
            onSelect={onFilterChange}
          />
        ))
      ) : (
        composition.map(row => (
          <PortfolioCompositionRow
            key={row.ticker}
            row={row}
            currency={filter === 'etf' ? row.currency : currency}
            showPercent={showPercent}
            onTogglePercent={() => setShowPercent(prev => !prev)}
            onLogoClick={handleLogoClick}
            logoUrl={logosByTicker.get(row.ticker)}
            compositionFilter={filter}
          />
        ))
      )}

      <PositionFormModal
        open={isFormOpen}
        portfolioId={portfolioId}
        defaults={
          selectedRow
            ? {
                ticker_symbol: selectedRow.ticker,
                asset_name: selectedRow.assetName,
                price: String(selectedRow.currentPrice),
                currency: selectedRow.currency,
                transaction_type: selectedRow.transactionType,
              }
            : undefined
        }
        hideCurrencyAndType
        isSubmitting={createPositionMutation.isPending}
        onSubmit={handleFormSubmit}
        onClose={handleCloseForm}
      />
    </Box>
  );
}
