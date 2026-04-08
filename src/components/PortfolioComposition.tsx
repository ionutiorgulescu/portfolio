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

const primaryTextSx = {
  color: '#393a36',
  fontFamily: '"Open Sans", sans-serif',
};

const secondaryTextSx = {
  color: '#61615e',
  fontFamily: '"Open Sans", sans-serif',
};

export function PortfolioComposition({ filter, portfolioId }: PortfolioCompositionProps) {
  const { composition, loading, error } = usePortfolioComposition(filter, portfolioId);
  const currency = filter === 'bvb' ? 'RON' : 'USD';

  if (error) return <Alert severity="error">{error.message}</Alert>;

  const maxWeight = composition[0]?.weight ?? 100;

  return (
    <Box sx={{ bgcolor: 'white', borderRadius: '16px', p: 3, boxShadow: '0 2px 4px rgba(0,0,0,0.10)' }}>
      <Typography
        sx={{
          ...primaryTextSx,
          fontSize: 20,
          lineHeight: '28px',
          fontWeight: 600,
          mb: 2,
        }}
      >
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
          <Typography
            sx={{
              ...secondaryTextSx,
              fontSize: { xs: 13, sm: 16 },
              lineHeight: { xs: '18px', sm: '20px' },
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Stock
          </Typography>
          <Typography
            sx={{
              ...secondaryTextSx,
              fontSize: { xs: 12, sm: 16 },
              lineHeight: { xs: '18px', sm: '20px' },
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              display: { xs: 'block', sm: 'none' },
            }}
          >
            Amount
          </Typography>
        </Box>

        <Typography
          sx={{
            ...secondaryTextSx,
            fontSize: { xs: 12, sm: 16 },
            lineHeight: { xs: '18px', sm: '20px' },
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            textAlign: 'right',
          }}
        >
          Weight
        </Typography>
        <Typography
          sx={{
            ...secondaryTextSx,
            fontSize: { xs: 12, sm: 16 },
            lineHeight: { xs: '18px', sm: '20px' },
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            textAlign: 'right',
          }}
        >
          Gain / Loss
        </Typography>
      </Box>

      {loading ? (
        [...Array(8)].map((_, i) => <RowSkeleton key={i} />)
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
      ) : (
        composition.map(row => (
          <PortfolioCompositionRow key={row.ticker} row={row} maxWeight={maxWeight} currency={currency} />
        ))
      )}
    </Box>
  );
}