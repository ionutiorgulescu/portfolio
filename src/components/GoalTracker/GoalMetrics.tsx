import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import type { GoalStats } from '../../hooks/useMonthlyGoal';

interface GoalMetricsProps {
  stats: GoalStats;
  loading: boolean;
  currencySymbol: string;
}

type Variant = 'default' | 'success' | 'danger';

interface MetricCardProps {
  label: string;
  value: string;
  variant?: Variant;
}

const variantColor: Record<Variant, string | undefined> = {
  default: undefined,
  success: '#16a34a',
  danger: '#dc2626',
};

const gridSx = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 2,
};

function MetricCardSkeleton() {
  return (
    <Box sx={{ bgcolor: 'white', borderRadius: '16px', p: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <Skeleton width={120} height={20} sx={{ mb: 1.5 }} />
      <Skeleton width={140} height={36} />
    </Box>
  );
}

function MetricCard({ label, value, variant = 'default' }: MetricCardProps) {
  return (
    <Box sx={{ bgcolor: 'white', borderRadius: '16px', p: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 500 }}>
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={700} sx={{ color: variantColor[variant] }}>
        {value}
      </Typography>
    </Box>
  );
}

export function GoalMetrics({ stats, loading, currencySymbol }: GoalMetricsProps) {
  const fmt = (n: number) =>
    currencySymbol === 'RON'
      ? n.toLocaleString('ro-RO', { maximumFractionDigits: 0 }) + ' RON'
      : '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });

  if (loading) {
    return (
      <Box sx={gridSx}>
        {Array.from({ length: 5 }).map((_, i) => <MetricCardSkeleton key={i} />)}
      </Box>
    );
  }

  return (
    <Box sx={gridSx}>
      <MetricCard label="Total Buys" value={fmt(stats.totalBuys)} />
      <MetricCard label="Total Sells" value={fmt(stats.totalSells)} />
      <MetricCard label="Avg / Month" value={fmt(stats.avgMonthly)} />
      <MetricCard label="Goal Met" value={`${stats.monthsMet} months`} variant="success" />
      <MetricCard label="Goal Missed" value={`${stats.monthsMissed} months`} variant="danger" />
    </Box>
  );
}
