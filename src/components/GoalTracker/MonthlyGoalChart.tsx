import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { TooltipContentProps } from 'recharts/types/component/Tooltip';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import type { MonthlyData } from '../../hooks/useMonthlyGoal';
import { color, shadow } from '../../theme/cssVars';

interface MonthlyGoalChartProps {
  months: MonthlyData[];
  goal: number;
  loading: boolean;
  currencySymbol: string;
}

interface ChartEntry extends MonthlyData {
  totalBuys: number;
  totalSells: number;
  totalInvested: number;
  shortfallBar: number;
  goal: number;
  currencySymbol: string;
}

const GAIN_COLOR = color.gain;
const SHORTFALL_COLOR = color.goalRemaining;
const BASE_BAR_COLOR = color.chartBase;
const MUTED = color.textSubtle;
const TEXT = color.textStrong;

const LEGEND = [
  { color: GAIN_COLOR, label: 'Goal met' },
  { color: SHORTFALL_COLOR, label: 'Remaining' },
];

function fmtAmount(value: number, symbol: string): string {
  if (symbol === 'RON') {
    return value.toLocaleString('ro-RO', { maximumFractionDigits: 0 }) + ' RON';
  }
  return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * Rounded bar with the curve on the outer tip (away from the baseline).
 * Matches PortfolioPerformance chart bar geometry.
 */
function RoundedGoalBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  tip: 'up' | 'flat';
}) {
  const { x = 0, width = 0, fill, tip } = props;
  if (!width || !props.height) return null;

  const rawY = props.y ?? 0;
  const rawH = props.height ?? 0;
  const top = rawH >= 0 ? rawY : rawY + rawH;
  const bottom = rawH >= 0 ? rawY + rawH : rawY;
  const absHeight = bottom - top;
  if (absHeight <= 0) return null;

  if (tip === 'flat') {
    return (
      <rect x={x} y={top} width={width} height={absHeight} fill={fill} />
    );
  }

  const radius = Math.min(8, width / 2, absHeight / 2);
  const d = [
    `M ${x},${bottom}`,
    `L ${x},${top + radius}`,
    `Q ${x},${top} ${x + radius},${top}`,
    `L ${x + width - radius},${top}`,
    `Q ${x + width},${top} ${x + width},${top + radius}`,
    `L ${x + width},${bottom}`,
    'Z',
  ].join(' ');
  return <path d={d} fill={fill} />;
}

function CustomTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload as ChartEntry | undefined;
  if (!entry) return null;

  const sym = entry.currencySymbol;

  return (
    <Box
      sx={{
        bgcolor: color.bgSurface,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        px: 1.5,
        py: 1.25,
        minWidth: 150,
        boxShadow: shadow.tooltip,
      }}
    >
      <Typography
        sx={{ fontSize: 14, lineHeight: '20px', fontWeight: 600, color: TEXT, mb: 0.5 }}
      >
        {String(label)}
      </Typography>
      {entry.hasData ? (
        <>
          <Typography sx={{ fontSize: 13, lineHeight: '18px', color: MUTED }} display="block">
            Buy:{' '}
            <Box component="span" sx={{ fontWeight: 600, color: TEXT }}>
              {fmtAmount(entry.totalBuys, sym)}
            </Box>
          </Typography>
          <Typography sx={{ fontSize: 13, lineHeight: '18px', color: MUTED }} display="block">
            Sell:{' '}
            <Box component="span" sx={{ fontWeight: 600, color: TEXT }}>
              {fmtAmount(entry.totalSells, sym)}
            </Box>
          </Typography>
          <Typography sx={{ fontSize: 13, lineHeight: '18px', color: MUTED }} display="block">
            Invested:{' '}
            <Box component="span" sx={{ fontWeight: 600, color: TEXT }}>
              {fmtAmount(entry.totalInvested, sym)}
            </Box>
          </Typography>
          {entry.metGoal ? (
            <Typography sx={{ fontSize: 13, lineHeight: '18px', color: GAIN_COLOR }} display="block">
              +{fmtAmount(entry.invested - entry.goal, sym)} above goal
            </Typography>
          ) : (
            <Typography sx={{ fontSize: 13, lineHeight: '18px', color: MUTED }} display="block">
              Remaining:{' '}
              <Box component="span" sx={{ fontWeight: 600, color: TEXT }}>
                {fmtAmount(entry.shortfall, sym)}
              </Box>
            </Typography>
          )}
        </>
      ) : (
        <Typography sx={{ fontSize: 13, lineHeight: '18px', color: MUTED }} display="block">
          No investment
        </Typography>
      )}
    </Box>
  );
}

export function MonthlyGoalChart({ months, goal, loading, currencySymbol }: MonthlyGoalChartProps) {
  if (loading) {
    return (
      <Skeleton
        variant="rounded"
        width="100%"
        height={240}
        sx={{ mt: 1, borderRadius: 2 }}
      />
    );
  }

  const data: ChartEntry[] = months.map((m) => ({
    ...m,
    totalBuys: m.buys,
    totalSells: m.sells,
    totalInvested: m.invested,
    goal,
    // Empty months stay blank (no light “remaining” stub).
    shortfallBar: m.hasData ? m.shortfall : 0,
    currencySymbol,
  }));

  const maxValue = Math.max(goal, ...data.map((d) => d.invested + d.shortfallBar), 1);
  const pad = maxValue * 0.12;
  const alternateLabels = data.length >= 12;

  return (
    <Box>
      <Box
        className="portfolio-chart"
        data-no-pull-refresh
        sx={{ width: '100%', height: { xs: 240, sm: 280 }, mt: 1 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 4, left: 4, bottom: 4 }}
            barCategoryGap="22%"
          >
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={({ x, y, payload, index }) => {
                const show = !alternateLabels || index % 2 === 0;
                if (!show) return <g />;
                return (
                  <text
                    x={x}
                    y={y}
                    dy={12}
                    textAnchor="middle"
                    fill={MUTED}
                    fontSize={13}
                  >
                    {payload.value}
                  </text>
                );
              }}
            />
            <YAxis hide domain={[0, maxValue + pad]} />
            <Tooltip
              content={CustomTooltip}
              cursor={{ fill: color.textStrong, opacity: 0.03 }}
            />
            <ReferenceLine
              y={goal}
              stroke={GAIN_COLOR}
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />

            <Bar
              dataKey="invested"
              stackId="goal"
              shape={(props) => {
                const entry = props.payload as ChartEntry | undefined;
                const tip = entry && entry.shortfallBar > 0 ? 'flat' : 'up';
                return <RoundedGoalBar {...props} tip={tip} />;
              }}
              maxBarSize={36}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell
                  key={`invested-${entry.key}`}
                  fill={!entry.hasData ? 'transparent' : GAIN_COLOR}
                />
              ))}
            </Bar>

            <Bar
              dataKey="shortfallBar"
              stackId="goal"
              shape={(props) => <RoundedGoalBar {...props} tip="up" />}
              maxBarSize={36}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell
                  key={`shortfall-${entry.key}`}
                  fill={entry.shortfallBar > 0 ? SHORTFALL_COLOR : 'transparent'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, mt: 1.5, px: 0.5 }}>
        {LEGEND.map((l) => (
          <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: l.color,
                border: l.color === SHORTFALL_COLOR ? `1px solid ${BASE_BAR_COLOR}` : undefined,
              }}
            />
            <Typography sx={{ fontSize: 13, lineHeight: '18px', color: MUTED }}>
              {l.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
