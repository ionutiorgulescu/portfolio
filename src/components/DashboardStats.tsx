import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { usePortfolioStats } from '../hooks/usePortfolioStats';
import type { CompositionFilter } from './FilterControl';

function formatCurrency(value: number, currency: 'USD' | 'RON' = 'USD'): string {
  return new Intl.NumberFormat(currency === 'RON' ? 'ro-RO' : 'en-US', {
    style: 'currency',
    currency,
  }).format(value);
}

function StatCardSkeleton() {
  return (
    <Box sx={{ bgcolor: 'white', borderRadius: '16px', p: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <Skeleton width={120} height={20} sx={{ mb: 1.5 }} />
      <Skeleton width={150} height={36} sx={{ mb: 1.25 }} />
      <Skeleton width={100} height={20} />
    </Box>
  );
}

const gridSx = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 2,
};

const statCardSx = {
  bgcolor: 'white',
  borderRadius: '16px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.10)',
  p: 3,
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
};

const statTitleSx = {
  fontSize: 20,
  lineHeight: '28px',
  color: '#393a36',
  fontWeight: 600,
};

const statValueSx = {
  fontSize: 40,
  lineHeight: '40px',
  fontWeight: 700,
  color: '#393a36',
};

const statSubTextSx = {
  fontSize: 20,
  lineHeight: '28px',
  color: '#61615e',
  mt: 1.5,
};

const chipSxBase = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '4px',
  borderWidth: '1px',
  borderStyle: 'solid',
  px: 1,
  py: 0.5,
  fontSize: 16,
  lineHeight: '20px',
  fontWeight: 600,
  width: 'fit-content',
};

type DashboardStatsProps = {
  filter: CompositionFilter;
  portfolioId: string;
};

export function DashboardStats({ filter, portfolioId }: DashboardStatsProps) {
  const { stats, loading, error } = usePortfolioStats(filter, portfolioId);

  if (error) return <Alert severity="error">{error.message}</Alert>;

  if (loading || !stats) {
    return (
      <Box sx={gridSx}>
        {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
      </Box>
    );
  }

  const gainPositive = stats.allTimeGain >= 0;
  const currency = filter === 'bvb' ? 'RON' : 'USD';

  return (
    <Box sx={gridSx}>
      <Box sx={statCardSx}>
        <Typography sx={statTitleSx}>
          Total Portfolio Value
        </Typography>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Typography sx={statValueSx}>
              {formatCurrency(stats.totalValue, currency)}
            </Typography>
            <Box
              component="span"
              sx={{
                ...chipSxBase,
                bgcolor: gainPositive ? '#edf9f8' : '#fdf2f7',
                borderColor: gainPositive ? '#9ed9d4' : '#ea88b2',
                color: gainPositive ? '#27a69a' : '#d92673',
              }}
            >
              {gainPositive ? '▲' : '▼'} {Math.abs(stats.allTimeGainPercent).toFixed(2)}%
            </Box>
          </Box>
          <Typography sx={statSubTextSx}>
            based on current holdings
          </Typography>
        </Box>
      </Box>

      <Box sx={statCardSx}>
        <Typography sx={statTitleSx}>All-Time Gain</Typography>
        <Box>
          <Typography
            sx={{
              ...statValueSx,
              color: gainPositive ? '#27a69a' : '#d92673',
            }}
          >
            {gainPositive ? '+' : ''}
            {formatCurrency(stats.allTimeGain, currency)}
          </Typography>
          <Typography sx={statSubTextSx}>
            vs cost basis {formatCurrency(stats.totalCostBasis, currency)}
          </Typography>
        </Box>
      </Box>

      <Box sx={statCardSx}>
        <Typography sx={statTitleSx}>Active Assets</Typography>
        <Box>
          <Typography sx={statValueSx}>{stats.activeTickers}</Typography>
          <Typography sx={statSubTextSx}>{stats.openPositions} buy transactions</Typography>
        </Box>
      </Box>
    </Box>
  );
}