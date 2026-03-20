import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { usePortfolioComposition } from '../hooks/usePortfolioComposition';
import type { CompositionFilter } from './FilterControl';
import { PortfolioCompositionRow } from './PortfolioCompositionRaw';

function RowSkeleton() {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 80px 100px',
        alignItems: 'center',
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        gap: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Skeleton variant="circular" width={40} height={40} />
        <Skeleton width={160} height={20} />
      </Box>
      <Skeleton width={50} height={20} />
      <Skeleton width={80} height={20} />
    </Box>
  );
}

type PortfolioCompositionProps = {
  filter: CompositionFilter;
  portfolioId: string;
};

export function PortfolioComposition({ filter, portfolioId }: PortfolioCompositionProps) {
  const { composition, loading, error } = usePortfolioComposition(filter, portfolioId);
  const currency = filter === 'bvb' ? 'RON' : 'USD';

  if (error) return <Alert severity="error">{error.message}</Alert>;

  const maxWeight = composition[0]?.weight ?? 100;

  return (
    <Box sx={{ bgcolor: 'white', borderRadius: '16px', p: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        Composition
      </Typography>

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
        {/* Stock column header — shows "Stock" on desktop, "Stock / Amount" on mobile */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.disabled" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Stock
          </Typography>
          <Typography
            variant="caption"
            color="text.disabled"
            fontWeight={600}
            sx={{
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              display: { xs: 'block', sm: 'none' },
            }}
          >
            Amount
          </Typography>
        </Box>

        <Typography variant="caption" color="text.disabled" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>
          Weight
        </Typography>
        <Typography variant="caption" color="text.disabled" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>
          Gain / Loss
        </Typography>
      </Box>

      {loading ? (
        [...Array(8)].map((_, i) => <RowSkeleton key={i} />)
      ) : composition.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ py: 4, textAlign: 'center' }}>
          No positions found.
        </Typography>
      ) : (
        composition.map(row => (
          <PortfolioCompositionRow key={row.ticker} row={row} maxWeight={maxWeight} currency={currency} />
        ))
      )}
    </Box>
  );
}