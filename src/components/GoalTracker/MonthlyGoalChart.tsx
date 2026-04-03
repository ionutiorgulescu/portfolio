import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { TooltipContentProps } from 'recharts/types/component/Tooltip';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import type { MonthlyData } from '../../hooks/useMonthlyGoal';

interface MonthlyGoalChartProps {
  months: MonthlyData[];
  goal: number;
  loading: boolean;
  currencySymbol: string;
}

interface ChartEntry extends MonthlyData {
  shortfallBar: number;
  goal: number;
  currencySymbol: string;
}

const COLOR_MET = '#3b82f6';
const COLOR_MISSED = '#6b7280';
const COLOR_SHORTFALL = '#ef4444';
const COLOR_GOAL = '#22c55e';

function formatCurrency(value: number, symbol: string): string {
  if (symbol === 'RON') {
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K RON`;
    return `${value} RON`;
  }
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

const LEGEND = [
  { color: COLOR_MET, label: 'Goal met' },
  { color: COLOR_MISSED, label: 'Goal missed' },
  { color: COLOR_SHORTFALL, label: 'Shortfall' },
];

function fmtAmount(value: number, symbol: string): string {
  if (symbol === 'RON') {
    return value.toLocaleString('ro-RO', { maximumFractionDigits: 0 }) + ' RON';
  }
  return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function CustomTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload as ChartEntry | undefined;
  if (!entry) return null;

  const sym = entry.currencySymbol;

  return (
    <Box sx={{ bgcolor: 'white', border: '1px solid', borderColor: 'divider', borderRadius: '12px', px: 1.5, py: 1.25, minWidth: 150, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
        {String(label)}
      </Typography>
      {entry.hasData ? (
        <>
          <Typography variant="caption" color="text.secondary" display="block">
            Invested:{' '}
            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {fmtAmount(entry.invested, sym)}
            </Box>
          </Typography>
          {entry.metGoal ? (
            <Typography variant="caption" sx={{ color: '#16a34a' }} display="block">
              +{fmtAmount(entry.invested - entry.goal, sym)} above goal
            </Typography>
          ) : (
            <Typography variant="caption" sx={{ color: '#dc2626' }} display="block">
              Shortfall:{' '}
              <Box component="span" sx={{ fontWeight: 600 }}>
                {fmtAmount(entry.shortfall, sym)}
              </Box>
            </Typography>
          )}
        </>
      ) : (
        <Typography variant="caption" color="text.disabled" display="block">
          No investment
        </Typography>
      )}
    </Box>
  );
}

export function MonthlyGoalChart({ months, goal, loading, currencySymbol }: MonthlyGoalChartProps) {
  if (loading) {
    return <Skeleton variant="rounded" width="100%" height={288} sx={{ borderRadius: '16px' }} />;
  }

  const data: ChartEntry[] = months.map(m => ({
    ...m,
    goal,
    shortfallBar: m.shortfall,
    currencySymbol,
  }));

  return (
    <Box sx={{ bgcolor: 'white', borderRadius: '16px', p: 2.5, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
          barSize={months.length > 24 ? 8 : months.length > 12 ? 12 : 20}
        >
          <CartesianGrid vertical={false} stroke="#e5e7eb" strokeOpacity={1} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            interval={months.length > 24 ? 2 : months.length > 12 ? 1 : 0}
            angle={months.length > 18 ? -45 : 0}
            textAnchor={months.length > 18 ? 'end' : 'middle'}
            height={months.length > 18 ? 40 : 24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatCurrency(v, currencySymbol)}
            width={48}
          />
          <Tooltip
            content={CustomTooltip}
            cursor={{ fill: '#000000', opacity: 0.03, radius: 4 }}
          />
          <ReferenceLine
            y={goal}
            stroke={COLOR_GOAL}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            label={{
              value: `Goal ${formatCurrency(goal, currencySymbol)}`,
              position: 'insideTopRight',
              fontSize: 11,
              fill: COLOR_GOAL,
              fontWeight: 600,
            }}
          />

          <Bar dataKey="invested" stackId="a" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map(entry => (
              <Cell
                key={entry.key}
                fill={!entry.hasData ? 'transparent' : entry.metGoal ? COLOR_MET : COLOR_MISSED}
              />
            ))}
          </Bar>

          <Bar dataKey="shortfallBar" stackId="a" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map(entry => (
              <Cell
                key={entry.key}
                fill={entry.shortfall > 0 ? COLOR_SHORTFALL : 'transparent'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, mt: 1, px: 0.5 }}>
        {LEGEND.map(l => (
          <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: l.color }} />
            <Typography variant="caption" color="text.secondary">{l.label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
