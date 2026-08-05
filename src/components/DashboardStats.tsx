import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
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

const HIDDEN_VALUE = '*****';
const VALUES_HIDDEN_STORAGE_KEY = 'dashboardStats.valuesHidden';

function maskCurrency(currency: 'USD' | 'RON'): string {
  return currency === 'RON' ? `${HIDDEN_VALUE} RON` : `$${HIDDEN_VALUE}`;
}

function readValuesHidden(): boolean {
  return localStorage.getItem(VALUES_HIDDEN_STORAGE_KEY) === 'true';
}

type DashboardStatsProps = {
  filter: CompositionFilter;
  portfolioId: string;
};

export function DashboardStats({ filter, portfolioId }: DashboardStatsProps) {
  const { stats, loading, error } = usePortfolioStats(filter, portfolioId);
  const [valuesHidden, setValuesHidden] = useState(readValuesHidden);

  const toggleValuesHidden = () => {
    setValuesHidden((hidden) => {
      const next = !hidden;
      localStorage.setItem(VALUES_HIDDEN_STORAGE_KEY, String(next));
      return next;
    });
  };

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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography sx={statTitleSx}>Total Value</Typography>
          <IconButton
            size="small"
            aria-label={valuesHidden ? 'Show total value and gains' : 'Hide total value and gains'}
            onClick={toggleValuesHidden}
            sx={{ color: '#61615e' }}
          >
            {valuesHidden ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
          </IconButton>
        </Box>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 2, rowGap: 1.5 }}>
            <Typography sx={statValueSx}>
              {valuesHidden ? maskCurrency(currency) : formatCurrency(stats.totalValue, currency)}
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
              {valuesHidden
                ? `${gainPositive ? '▲' : '▼'} ${HIDDEN_VALUE}%`
                : `${gainPositive ? '▲' : '▼'} ${Math.abs(stats.allTimeGainPercent).toFixed(2)}%`}
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
            {valuesHidden
              ? `${gainPositive ? '+' : ''}${maskCurrency(currency)}`
              : `${gainPositive ? '+' : ''}${formatCurrency(stats.allTimeGain, currency)}`}
          </Typography>
          <Typography sx={statSubTextSx}>
            vs cost basis {valuesHidden ? maskCurrency(currency) : formatCurrency(stats.totalCostBasis, currency)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
