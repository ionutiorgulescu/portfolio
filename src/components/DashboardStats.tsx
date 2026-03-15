import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { usePortfolioStats } from '../hooks/usePortfolioStats';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
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

export function DashboardStats() {
  const { stats, loading, error } = usePortfolioStats();

  if (error) {
    return <Alert severity="error">{error.message}</Alert>;
  }

  if (loading || !stats) {
    return (
      <Box sx={gridSx}>
        {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
      </Box>
    );
  }

  const gainPositive = stats.allTimeGain >= 0;

  return (
    <Box sx={gridSx}>

      {/* Total Portfolio Value */}
      <Box sx={{ bgcolor: 'white', borderRadius: '16px', p: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 500 }}>
          Total Portfolio Value
        </Typography>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 1.25 }}>
          {formatCurrency(stats.totalValue)}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component="span"
            sx={{
              bgcolor: gainPositive ? '#dcfce7' : '#fee2e2',
              color: gainPositive ? '#16a34a' : '#dc2626',
              fontSize: 12,
              fontWeight: 600,
              px: 1,
              py: 0.25,
              borderRadius: '20px',
            }}
          >
            {gainPositive ? '↑' : '↓'} {Math.abs(stats.allTimeGainPercent).toFixed(2)}%
          </Box>
          <Typography variant="caption" color="text.disabled">all time</Typography>
        </Box>
      </Box>

      {/* All-Time Gain */}
      <Box sx={{ bgcolor: 'white', borderRadius: '16px', p: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 500 }}>
          All-Time Gain
        </Typography>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 1.25, color: gainPositive ? '#16a34a' : '#dc2626' }}>
          {gainPositive ? '+' : ''}{formatCurrency(stats.allTimeGain)}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          vs cost basis {formatCurrency(stats.totalCostBasis)}
        </Typography>
      </Box>

      {/* Total Assets */}
      <Box sx={{ bgcolor: 'white', borderRadius: '16px', p: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 500 }}>
          Total Assets
        </Typography>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 1.25 }}>
          {stats.totalPositions}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component="span"
            sx={{ bgcolor: '#dbeafe', color: '#2563eb', fontSize: 12, fontWeight: 600, px: 1, py: 0.25, borderRadius: '20px' }}
          >
            {stats.openPositions} open
          </Box>
          <Typography variant="caption" color="text.disabled">
            {stats.closedPositions} closed
          </Typography>
        </Box>
      </Box>

      {/* Active Tickers */}
      <Box sx={{ bgcolor: 'white', borderRadius: '16px', p: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 500 }}>
          Active Tickers
        </Typography>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 1.25 }}>
          {stats.activeTickers}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {stats.openPositions} open positions
        </Typography>
      </Box>

    </Box>
  );
}