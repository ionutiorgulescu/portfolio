import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { usePortfolioComposition } from '../hooks/usePortfolioComposition';
import type { CompositionFilter } from './FilterControl';
import { CompositionRow } from './PortfolioCompositionRaw';
import { RowSkeleton } from './RowSkeleton';
interface PortfolioCompositionProps {
  filter: CompositionFilter;
}

export function PortfolioComposition({ filter }: PortfolioCompositionProps) {
  const { composition, loading, error } = usePortfolioComposition(filter);

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
        <Typography variant="caption" color="text.disabled" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Asset
        </Typography>
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
          <CompositionRow key={row.ticker} row={row} maxWeight={maxWeight} />
        ))
      )}
    </Box>
  );
}
