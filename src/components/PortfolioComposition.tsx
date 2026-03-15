import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { usePortfolioComposition } from '../hooks/usePortfolioComposition';
import type { TickerComposition } from '../hooks/usePortfolioComposition';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function RowSkeleton() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', alignItems: 'center', py: 1.5, borderBottom: '1px solid', borderColor: 'divider', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Skeleton variant="circular" width={40} height={40} />
        <Skeleton width={160} height={20} />
      </Box>
      <Skeleton width={50} height={20} />
      <Skeleton width={80} height={20} />
    </Box>
  );
}

function CompositionRow({ row, maxWeight }: { row: TickerComposition; maxWeight: number }) {
  const gainPositive = row.gainLoss >= 0;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 80px 110px',
        alignItems: 'center',
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        gap: 2,
        '&:last-child': { borderBottom: 'none' },
        '&:hover': { bgcolor: 'grey.50' },
        transition: 'background-color 0.15s ease',
      }}
    >
      {/* Stock name + progress bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
        {/* Ticker avatar */}
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: 'grey.100',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: 10 }}>
            {row.ticker.slice(0, 4)}
          </Typography>
        </Box>

        {/* Name + bar */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%' }}>
            {/* Progress bar background */}
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                height: 32,
                width: `${(row.weight / maxWeight) * 100}%`,
                bgcolor: 'grey.100',
                borderRadius: '6px',
                zIndex: 0,
              }}
            />
            <Typography
              variant="body2"
              fontWeight={500}
              sx={{
                position: 'relative',
                zIndex: 1,
                px: 1,
                py: 0.5,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {row.assetName}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Weight */}
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
        {formatPercent(row.weight)}
      </Typography>

      {/* Gain/Loss */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{ color: gainPositive ? '#16a34a' : '#dc2626' }}
        >
          {gainPositive ? '↑' : '↓'} {gainPositive ? '+' : ''}{formatCurrency(row.gainLoss)}
        </Typography>
      </Box>
    </Box>
  );
}

export function PortfolioComposition() {
  const { composition, loading, error } = usePortfolioComposition();

  if (error) {
    return <Alert severity="error">{error.message}</Alert>;
  }

  const maxWeight = composition[0]?.weight ?? 100;

  return (
    <Box sx={{ bgcolor: 'white', borderRadius: '16px', p: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        Composition
      </Typography>

      {/* Column headers */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 80px 110px',
          gap: 2,
          pb: 1,
          borderBottom: '2px solid',
          borderColor: 'divider',
          mb: 0.5,
        }}
      >
        <Typography variant="caption" color="text.disabled" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Stock
        </Typography>
        <Typography variant="caption" color="text.disabled" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>
          Weight
        </Typography>
        <Typography variant="caption" color="text.disabled" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>
          Gain / Loss
        </Typography>
      </Box>

      {/* Rows */}
      {loading ? (
        [...Array(8)].map((_, i) => <RowSkeleton key={i} />)
      ) : composition.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ py: 4, textAlign: 'center' }}>
          No positions found.
        </Typography>
      ) : (
        composition.map(row => (
          <CompositionRow key={row.ticker} row={row} maxWeight={maxWeight} />
        ))
      )}
    </Box>
  );
}