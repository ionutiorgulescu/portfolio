import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import type { GoalStats, RangeOption } from '../../hooks/useMonthlyGoal';

interface GoalMetricsProps {
    stats: GoalStats;
    goal: number;
    loading: boolean;
    currencySymbol: string;
    range: RangeOption;
}

type Variant = 'default' | 'success' | 'danger';

interface MetricCardProps {
    label: string;
    value: string;
    variant?: Variant;
}

const primaryTextSx = {
    color: '#393a36',
    fontFamily: '"Open Sans", sans-serif',
};

const secondaryTextSx = {
    color: '#61615e',
    fontFamily: '"Open Sans", sans-serif',
};

const variantColor: Record<Variant, string | undefined> = {
    default: '#393a36',
    success: '#27a69a',
    danger: '#d92673',
};

const gridSx = {
    display: 'grid',
    gridTemplateColumns: {
        xs: '1fr',
        sm: 'repeat(2, minmax(0, 1fr))',
        lg: 'repeat(3, minmax(0, 1fr))',
    },
    gap: { xs: 1.5, sm: 2 },
};

const cardSx = {
    bgcolor: 'white',
    borderRadius: '16px',
    p: { xs: 2, sm: 3 },
    boxShadow: '0 2px 4px rgba(0,0,0,0.10)',
    minWidth: 0,
};

function MetricCardSkeleton({ withBar = false }: { withBar?: boolean }) {
    return (
        <Box sx={cardSx}>
            <Skeleton width={120} height={20} sx={{ mb: 1.5 }} />
            <Skeleton width={140} height={36} />
            {withBar && <Skeleton width="100%" height={6} sx={{ mt: 2, borderRadius: 3 }} />}
        </Box>
    );
}

function MetricCard({ label, value, variant = 'default' }: MetricCardProps) {
    return (
        <Box sx={cardSx}>
            <Typography
                sx={{
                    ...primaryTextSx,
                    mb: 1.5,
                    fontSize: { xs: 16, sm: 18, md: 20 },
                    lineHeight: { xs: '24px', sm: '26px', md: '28px' },
                    fontWeight: 600,
                }}
            >
                {label}
            </Typography>
            <Typography
                sx={{
                    fontFamily: '"Open Sans", sans-serif',
                    fontSize: { xs: 28, sm: 34, md: 40 },
                    lineHeight: { xs: '34px', sm: '36px', md: '40px' },
                    fontWeight: 700,
                    color: variantColor[variant],
                    wordBreak: 'break-word',
                }}
            >
                {value}
            </Typography>
        </Box>
    );
}

interface ProgressCardProps {
    label: string;
    current: number;
    total: number;
    fmt: (n: number) => string;
}

function ProgressCard({ label, current, total, fmt }: ProgressCardProps) {
    const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    return (
        <Box sx={{ ...cardSx, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Typography
                sx={{
                    ...primaryTextSx,
                    mb: 1.5,
                    fontSize: { xs: 16, sm: 18, md: 20 },
                    lineHeight: { xs: '24px', sm: '26px', md: '28px' },
                    fontWeight: 600,
                }}
            >
                {label}
            </Typography>
            <Typography
                sx={{
                    ...primaryTextSx,
                    fontSize: { xs: 28, sm: 34, md: 40 },
                    lineHeight: { xs: '34px', sm: '36px', md: '40px' },
                    fontWeight: 700,
                    wordBreak: 'break-word',
                }}
            >
                {fmt(current)}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'baseline' }, flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 0.5, sm: 0 }, mt: 0.5, mb: 1.5 }}>
                <Typography sx={{ ...secondaryTextSx, fontSize: { xs: 14, sm: 16 }, lineHeight: { xs: '18px', sm: '20px' }, wordBreak: 'break-word' }}>
                    of {fmt(total)} goal
                </Typography>
                <Typography sx={{ ...secondaryTextSx, fontSize: { xs: 14, sm: 16 }, lineHeight: { xs: '18px', sm: '20px' }, fontWeight: 600 }}>
                    {pct}%
                </Typography>
            </Box>
            <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'grey.100', overflow: 'hidden' }}>
                <Box sx={{
                    height: '100%',
                    width: `${pct}%`,
                    borderRadius: 3,
                    background: 'linear-gradient(90deg, #7c3aed, #059669)',
                    transition: 'width 0.4s ease',
                }} />
            </Box>
        </Box>
    );
}

export function GoalMetrics({ stats, loading, currencySymbol, goal, range }: GoalMetricsProps) {
    const fmt = (n: number) =>
        currencySymbol === 'RON'
            ? n.toLocaleString('ro-RO', { maximumFractionDigits: 0 }) + ' RON'
            : '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });

    const rangeYear = parseInt(range);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const monthsElapsed = rangeYear < currentYear ? 12 : rangeYear === currentYear ? currentMonth : 0;
    const expectedSoFar = goal * monthsElapsed;
    const isAhead = monthsElapsed > 0 && stats.totalInvested >= expectedSoFar;

    const scheduleLabel = monthsElapsed === 0 ? '—' : isAhead ? 'Ahead of Schedule' : 'Under Schedule';
    const scheduleVariant: Variant = monthsElapsed === 0 ? 'default' : isAhead ? 'success' : 'danger';

    if (loading) {
        return (
            <Box sx={gridSx}>
                {Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} withBar={i === 2} />)}
            </Box>
        );
    }

    return (
        <Box sx={gridSx}>
            <ProgressCard label="Year Progress" current={stats.totalInvested} total={goal * 12} fmt={fmt} />
            <MetricCard label="Avg / Month" value={fmt(stats.avgMonthly)} />
            <MetricCard label="Schedule Status" value={scheduleLabel} variant={scheduleVariant} />
        </Box>
    );
}
