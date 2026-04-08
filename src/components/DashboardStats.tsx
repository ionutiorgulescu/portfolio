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
    <Box sx={{ bgcolor: 'white', borderRadius: '16px', p: { xs: 2, sm: 3 }, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <Skeleton width={120} height={20} sx={{ mb: 1.5, width: { xs: '55%', sm: 120 } }} />
      <Skeleton width={150} height={36} sx={{ mb: 1.25, width: { xs: '70%', sm: 150 } }} />
      <Skeleton width={100} height={20} />
    </Box>
  );
}

const gridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(240px, 1fr))' },
  gap: 2,
};

const statCardSx = {
  bgcolor: 'white',
  borderRadius: '16px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.10)',
  p: { xs: 2, sm: 3 },
  display: 'flex',
  flexDirection: 'column',
  gap: { xs: 2, sm: 3 },
};

const statTitleSx = {
  fontSize: { xs: 16, sm: 18, md: 20 },
  lineHeight: { xs: '24px', sm: '26px', md: '28px' },
  color: '#393a36',
  fontWeight: 600,
};

const statValueSx = {
  fontSize: { xs: 28, sm: 34, md: 40 },
  lineHeight: { xs: '32px', sm: '36px', md: '40px' },
  fontWeight: 700,
  color: '#393a36',
  wordBreak: 'break-word',
};

const statSubTextSx = {
  fontSize: { xs: 14, sm: 16, md: 20 },
  lineHeight: { xs: '20px', sm: '24px', md: '28px' },
  color: '#61615e',
  mt: { xs: 1, sm: 1.5 },
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
  fontSize: { xs: 14, sm: 16 },
  lineHeight: { xs: '18px', sm: '20px' },
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
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 2, rowGap: 1.5 }}>
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