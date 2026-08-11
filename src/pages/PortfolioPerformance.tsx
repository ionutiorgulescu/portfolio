import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  ButtonBase,
  IconButton,
  Skeleton,
  Stack,
  SwipeableDrawer,
  Typography,
} from '@mui/material';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import NorthIcon from '@mui/icons-material/North';
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { usePortfolioContext } from '../contexts/PortfolioContext';
import { usePortfolioPerformance } from '../hooks/usePortfolioPerformance';
import { computeXirrPercent } from '../services/irr';
import { computeTtwrorPercent } from '../services/performanceSeries';
import type {
  CashFlowPoint,
  PortfolioDataPoint,
  RealizedGainPoint,
} from '../types/performance';

const GAIN_COLOR = '#27a69a';
const LOSS_COLOR = '#d92673';
const BASE_BAR_COLOR = '#e5e7eb';
const MUTED = '#9ca3af';
const TEXT = '#111827';
const CHIP_BG = '#f3f4f6';

const INVESTED_CAPITAL_DEFINITION =
  'Invested capital refers to the initial amount of money or assets that an investor puts into an investment. It represents the principal or the original value of the investment.';

const PRICE_GAIN_DEFINITION =
  'Price gains/losses represent the change in the value of an investment over a certain period of time. They reflect the increase or decrease in the market price of an investment. Price gains/losses are not realized until the investment is sold or disposed of, at which point they become realised gains/losses. The relative return is calculated by dividing price gains/losses by the invested capital.';

const REALIZED_GAIN_DEFINITION =
  'Realised gains/losses pertain to the profits or losses that are actually experienced when an investment is sold or disposed of. It represents the difference between the selling price of an investment and its original purchase price. The relative return is calculated by dividing the sum of profits/losses by the sum of the purchase price of the securities that were sold.';

const IRR_DEFINITION =
  'The internal rate of return (IRR) measures your actual return, including the timing of your deposits and withdrawals. It shows how your investment strategy performed. IRR is annualized.';

const TTWROR_DEFINITION =
  'The Time-Weighted Rate of Return (TTWROR) measures how your investments performed, removing the effect of deposits and withdrawals. Best for comparing to market benchmarks. By default this is shown for all time.';

const AVERAGE_RETURN_DEFINITION =
  'The average line in the bar chart represents the average return of the portfolio over the investment horizon.';

type PeriodKey = 'alltime' | string;

function buildPeriods(years: number[]): { key: PeriodKey; label: string }[] {
  return [
    { key: 'alltime', label: 'Alltime' },
    ...years.map((year) => {
      const key = String(year);
      return { key, label: key };
    }),
  ];
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

type ChartBarPoint = {
  label: string;
  /** Signed time-weighted return % for this bar (month or year). */
  returnPct: number;
  /** Segment above the zero line (green gain or grey ghost). */
  above: number;
  /** Segment below the zero line (red loss or grey ghost). */
  below: number;
  /** Future / empty month placeholder — excluded from Ø average. */
  placeholder?: boolean;
};

function formatUsd(value: number) {
  const abs = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-$${abs}` : `$${abs}`;
}

/** Snapshot at period end (all-time = latest point). */
function periodEndPoint(
  data: PortfolioDataPoint[],
  period: PeriodKey | string,
): PortfolioDataPoint | null {
  if (data.length === 0) return null;

  if (period === 'alltime') {
    return data[data.length - 1];
  }

  const yearPoints = data.filter((p) => p.date.startsWith(period));
  if (yearPoints.length === 0) return null;
  return yearPoints[yearPoints.length - 1];
}

/**
 * Baseline before the period so year P&L is the change during that year.
 * All-time starts at the first series point.
 */
function periodStartPoint(
  data: PortfolioDataPoint[],
  period: PeriodKey | string,
): PortfolioDataPoint | null {
  if (data.length === 0) return null;

  if (period === 'alltime') {
    return data[0];
  }

  const prior = data.filter((p) => p.date < `${period}-01-01`);
  if (prior.length > 0) return prior[prior.length - 1];

  const yearPoints = data.filter((p) => p.date.startsWith(period));
  return yearPoints[0] ?? null;
}

/**
 * Period price gain (unrealized P&L change), cash-flow adjusted:
 * (end.value − end.costBasis) − (start.value − start.costBasis)
 * ≡ end.value − start.value − ΔcostBasis
 * Relative % uses invested capital at period end (getquin).
 */
function priceGainForPeriod(
  data: PortfolioDataPoint[],
  period: PeriodKey,
): { gain: number; percent: number } | null {
  const start = periodStartPoint(data, period);
  const end = periodEndPoint(data, period);
  if (!start || !end) return null;

  const gain =
    end.value - start.value - (end.costBasis - start.costBasis);
  const percent =
    end.costBasis > 1e-9 ? (gain / end.costBasis) * 100 : 0;

  return { gain, percent };
}

/**
 * Realized P&L from FIFO-matched sells in the period:
 * gain = Σ(sell proceeds − purchase cost of sold lots)
 * relative % = gain / Σ(purchase cost of sold lots)
 */
function realizedGainForPeriod(
  events: RealizedGainPoint[],
  period: PeriodKey,
): { gain: number; percent: number } {
  const filtered =
    period === 'alltime'
      ? events
      : events.filter((event) => event.date.startsWith(period));

  const gain = filtered.reduce((sum, event) => sum + event.gain, 0);
  const cost = filtered.reduce((sum, event) => sum + event.cost, 0);
  const percent = cost > 1e-9 ? (gain / cost) * 100 : 0;

  return { gain, percent };
}

/**
 * Annualized money-weighted return (XIRR) for the selected period.
 * Buys/sells are cash flows; remaining market value is the terminal inflow.
 * For calendar years with prior holdings, opening market value is a synthetic outflow.
 */
function irrForPeriod(
  data: PortfolioDataPoint[],
  cashFlows: CashFlowPoint[],
  period: PeriodKey,
): number | null {
  const end = periodEndPoint(data, period);
  if (!end) return null;

  const flows: CashFlowPoint[] = [];

  if (period === 'alltime') {
    for (const cf of cashFlows) {
      if (cf.date <= end.date) flows.push(cf);
    }
  } else {
    const periodStart = `${period}-01-01`;
    const prior = data.filter((p) => p.date < periodStart);

    if (prior.length > 0) {
      const start = prior[prior.length - 1];
      if (start.value > 1e-9) {
        flows.push({ date: start.date, amount: -start.value });
      }
    }

    for (const cf of cashFlows) {
      if (cf.date >= periodStart && cf.date <= end.date) {
        flows.push(cf);
      }
    }
  }

  flows.push({ date: end.date, amount: end.value });
  return computeXirrPercent(flows);
}

/**
 * Cumulative true time-weighted return for the selected period.
 * Uses buy/sell cash flows (not cost-basis deltas) so sells remove proceeds.
 *
 * `period` may be:
 * - `'alltime'`
 * - `'YYYY'` (calendar year)
 * - `'YYYY-MM'` (calendar month)
 */
function ttwrorForPeriod(
  data: PortfolioDataPoint[],
  cashFlows: CashFlowPoint[],
  period: PeriodKey | string,
): number | null {
  if (data.length === 0) return null;

  let points: PortfolioDataPoint[];

  if (period === 'alltime') {
    points = data;
  } else {
    const periodPoints = data.filter((p) => p.date.startsWith(period));
    if (periodPoints.length === 0) return null;

    // Baseline just before the window so the first day's move is included.
    const periodStart =
      period.length === 4 ? `${period}-01-01` : `${period}-01`;
    const prior = data.filter((p) => p.date < periodStart);
    const start = prior.length > 0 ? prior[prior.length - 1] : null;

    points =
      start && start.date < periodPoints[0].date
        ? [start, ...periodPoints]
        : periodPoints;
  }

  const startDate = points[0]?.date;
  const endDate = points[points.length - 1]?.date;
  if (!startDate || !endDate) return null;

  const periodFlows = cashFlows.filter(
    (cf) => cf.date > startDate && cf.date <= endDate,
  );

  return computeTtwrorPercent(points, periodFlows);
}

/** True when the portfolio had capital during the period prefix (`YYYY` / `YYYY-MM`). */
function periodHasCapital(
  data: PortfolioDataPoint[],
  periodPrefix: string,
): boolean {
  for (const point of data) {
    if (!point.date.startsWith(periodPrefix)) continue;
    if (point.value > 1 || point.costBasis > 1) return true;
  }
  return false;
}

function monthAxisLabel(yearMonth: string): string {
  const monthIndex = Number(yearMonth.slice(5, 7)) - 1;
  return MONTH_LABELS[monthIndex] ?? yearMonth;
}

/** Full Jan–Dec for a year (getquin keeps upcoming months visible). */
function monthsForYearChart(year: string): string[] {
  const months: string[] = [];
  for (let month = 1; month <= 12; month += 1) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return months;
}

/**
 * Bar-chart series for the selected period (getquin-style):
 * - Alltime → one bar per calendar year (year TWR)
 * - Year → Jan–Dec monthly TWRs (future months as empty stubs)
 *
 * Ø average return is the arithmetic mean of non-placeholder bar values.
 */
function buildPerformanceChartBars(
  data: PortfolioDataPoint[],
  cashFlows: CashFlowPoint[],
  period: PeriodKey,
  years: number[],
): ChartBarPoint[] {
  if (data.length === 0) return [];

  if (period === 'alltime') {
    const returns = [...years]
      .slice()
      .sort((a, b) => a - b)
      .filter((year) => periodHasCapital(data, String(year)))
      .map((year) => {
        const key = String(year);
        const returnPct = ttwrorForPeriod(data, cashFlows, key);
        if (returnPct == null) return null;
        return { label: key, returnPct, placeholder: false };
      })
      .filter(
        (row): row is { label: string; returnPct: number; placeholder: boolean } =>
          row != null,
      );

    if (returns.length === 0) return [];
    return toChartBarPoints(returns);
  }

  // Year view: always render Jan→Dec so the ongoing year shows next months.
  const returns = monthsForYearChart(period).map((month) => {
    const label = monthAxisLabel(month);
    const hasCapital = periodHasCapital(data, month);
    if (!hasCapital) {
      return { label, returnPct: 0, placeholder: true };
    }
    const returnPct = ttwrorForPeriod(data, cashFlows, month) ?? 0;
    return { label, returnPct, placeholder: false };
  });

  return toChartBarPoints(returns);
}

function toChartBarPoints(
  returns: Array<{ label: string; returnPct: number; placeholder: boolean }>,
): ChartBarPoint[] {
  const active = returns.filter((row) => !row.placeholder);
  const maxAbs = Math.max(
    ...active.map((row) => Math.abs(row.returnPct)),
    1,
  );
  // Opposite-side grey ghost (getquin): short shelf across the zero line.
  const ghost = Math.min(Math.max(maxAbs * 0.22, 1.2), maxAbs * 0.45);
  const stub = Math.min(ghost * 0.35, 1);

  return returns.map(({ label, returnPct, placeholder }) => {
    if (placeholder) {
      return {
        label,
        returnPct: 0,
        above: 0,
        below: 0,
        placeholder: true,
      };
    }
    if (returnPct > 0) {
      return { label, returnPct, above: returnPct, below: -ghost };
    }
    if (returnPct < 0) {
      return { label, returnPct, above: ghost, below: returnPct };
    }
    return { label, returnPct, above: stub, below: -stub };
  });
}

/** Arithmetic mean of chart bar returns (Ø metric). */
function averageReturnFromBars(bars: ChartBarPoint[]): number | null {
  const active = bars.filter((bar) => !bar.placeholder);
  if (active.length === 0) return null;
  const sum = active.reduce((acc, bar) => acc + bar.returnPct, 0);
  return sum / active.length;
}

function PeriodSelector({
  value,
  onChange,
  periods,
}: {
  value: PeriodKey;
  onChange: (period: PeriodKey) => void;
  periods: { key: PeriodKey; label: string }[];
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        pb: 0.5,
      }}
    >
      <IconButton
        size="small"
        aria-label="Custom date range"
        sx={{ color: MUTED, flexShrink: 0 }}
      >
        <CalendarTodayOutlinedIcon sx={{ fontSize: 20 }} />
      </IconButton>

      {periods.map((period) => {
        const selected = value === period.key;
        return (
          <ButtonBase
            key={period.key}
            onClick={() => onChange(period.key)}
            sx={{
              flexShrink: 0,
              borderRadius: '999px',
              px: 1.75,
              py: 0.85,
              bgcolor: selected ? CHIP_BG : 'transparent',
              transition: 'background-color 0.15s ease',
              '&:hover': {
                bgcolor: selected ? CHIP_BG : 'rgba(0,0,0,0.04)',
              },
            }}
          >
            <Typography
              sx={{
                fontSize: 14,
                fontWeight: selected ? 700 : 500,
                color: selected ? TEXT : MUTED,
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              {period.label}
            </Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

/**
 * Rounded bar with the curve on the outer tip (away from the zero line).
 * `tip="down"` inverts the radius for everything below the middle line.
 */
function RoundedPerformanceBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  tip: 'up' | 'down';
}) {
  const { x = 0, width = 0, fill, tip } = props;
  if (!width || !props.height) return null;

  // Normalize Recharts' signed-height rect into top/bottom in SVG space.
  const rawY = props.y ?? 0;
  const rawH = props.height ?? 0;
  const top = rawH >= 0 ? rawY : rawY + rawH;
  const bottom = rawH >= 0 ? rawY + rawH : rawY;
  const absHeight = bottom - top;
  if (absHeight <= 0) return null;

  const radius = Math.min(8, width / 2, absHeight / 2);

  if (tip === 'up') {
    // Above zero — round the top tip, flat on the zero line.
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

  // Below zero — inverted: round the bottom tip, flat on the zero line.
  const d = [
    `M ${x},${top}`,
    `L ${x + width},${top}`,
    `L ${x + width},${bottom - radius}`,
    `Q ${x + width},${bottom} ${x + width - radius},${bottom}`,
    `L ${x + radius},${bottom}`,
    `Q ${x},${bottom} ${x},${bottom - radius}`,
    'Z',
  ].join(' ');
  return <path d={d} fill={fill} />;
}

function PerformanceBarChart({
  bars,
  alternateLabels = false,
}: {
  bars: ChartBarPoint[];
  /** When true (year view), show Jan / skip Feb / show Mar / … */
  alternateLabels?: boolean;
}) {
  const maxAbove = Math.max(...bars.map((bar) => bar.above), 1);
  const maxBelow = Math.min(...bars.map((bar) => bar.below), -1);
  const pad = Math.max(maxAbove, Math.abs(maxBelow)) * 0.12;

  return (
    <Box
      className="portfolio-chart"
      data-no-pull-refresh
      sx={{ width: '100%', height: { xs: 240, sm: 280 }, mt: 1 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={bars}
          margin={{ top: 8, right: 4, left: 4, bottom: 4 }}
          barCategoryGap={alternateLabels ? '22%' : '32%'}
          stackOffset="sign"
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
          <YAxis hide domain={[maxBelow - pad, maxAbove + pad]} />
          <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} />
          <Bar
            dataKey="above"
            stackId="perf"
            shape={(props) => <RoundedPerformanceBar {...props} tip="up" />}
            maxBarSize={alternateLabels ? 36 : 52}
            isAnimationActive={false}
          >
            {bars.map((entry) => (
              <Cell
                key={`above-${entry.label}`}
                fill={
                  entry.placeholder || entry.returnPct < 0
                    ? BASE_BAR_COLOR
                    : GAIN_COLOR
                }
              />
            ))}
          </Bar>
          <Bar
            dataKey="below"
            stackId="perf"
            shape={(props) => <RoundedPerformanceBar {...props} tip="down" />}
            maxBarSize={alternateLabels ? 36 : 52}
            isAnimationActive={false}
          >
            {bars.map((entry) => (
              <Cell
                key={`below-${entry.label}`}
                fill={
                  !entry.placeholder && entry.returnPct < 0
                    ? LOSS_COLOR
                    : BASE_BAR_COLOR
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: { xs: 20, sm: 22 },
        fontWeight: 700,
        color: TEXT,
        letterSpacing: '-0.02em',
        mb: 1.5,
      }}
    >
      {children}
    </Typography>
  );
}

function MetricInfoSheet({
  open,
  title,
  description,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => undefined}
      disableSwipeToOpen
      slotProps={{
        paper: {
          sx: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            px: 3,
            pt: 1.25,
            pb: 'max(28px, env(safe-area-inset-bottom))',
            maxWidth: 720,
            mx: 'auto',
            width: '100%',
          },
        },
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 4,
          borderRadius: 999,
          bgcolor: '#d1d5db',
          mx: 'auto',
          mb: 2.5,
        }}
      />
      <Typography
        sx={{
          fontSize: 22,
          fontWeight: 700,
          color: TEXT,
          letterSpacing: '-0.02em',
          mb: 1.25,
        }}
      >
        {title}
      </Typography>
      <Typography
        sx={{
          fontSize: 15,
          lineHeight: 1.55,
          color: '#4b5563',
          pb: 1,
        }}
      >
        {description}
      </Typography>
    </SwipeableDrawer>
  );
}

function MetricRow({
  label,
  value,
  percent,
  amount,
  bold,
  locked,
  showInfo = true,
  onInfoClick,
}: {
  label: string;
  value?: string;
  percent?: number;
  /** Numeric amount used for gain/loss coloring when `percent` is omitted. */
  amount?: number;
  bold?: boolean;
  locked?: boolean;
  showInfo?: boolean;
  onInfoClick?: () => void;
}) {
  const signed = amount ?? percent;
  const positive = signed == null || signed >= 0;
  const accent = positive ? GAIN_COLOR : LOSS_COLOR;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        py: 1.75,
        borderBottom: '1px solid',
        borderColor: 'rgba(0,0,0,0.06)',
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: { xs: 15, sm: 16 },
            fontWeight: bold ? 700 : 500,
            color: TEXT,
          }}
        >
          {label}
        </Typography>
        {showInfo && (
          <IconButton
            size="small"
            aria-label={`About ${label}`}
            onClick={onInfoClick}
            disabled={!onInfoClick}
            sx={{ color: MUTED, p: 0.35 }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>

      {locked ? (
        <LockOutlinedIcon sx={{ fontSize: 18, color: MUTED }} />
      ) : (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1.5, sm: 2.5 },
            flexShrink: 0,
          }}
        >
          {percent != null && (
            <Typography
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.15,
                fontSize: { xs: 14, sm: 15 },
                fontWeight: 600,
                color: accent,
                minWidth: { sm: 84 },
                justifyContent: 'flex-end',
              }}
            >
              <NorthIcon
                sx={{
                  fontSize: 14,
                  transform: positive ? 'none' : 'rotate(180deg)',
                }}
              />
              {Math.abs(percent).toFixed(2)}%
            </Typography>
          )}
          {value != null && (
            <Typography
              sx={{
                fontSize: { xs: 15, sm: 16 },
                fontWeight: bold ? 700 : 500,
                color: bold ? accent : TEXT,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.15,
                minWidth: { xs: 96, sm: 110 },
                justifyContent: 'flex-end',
              }}
            >
              {bold && (
                <NorthIcon
                  sx={{
                    fontSize: 14,
                    color: accent,
                    transform: positive ? 'none' : 'rotate(180deg)',
                  }}
                />
              )}
              {value}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

const PortfolioPerformance = () => {
  const [period, setPeriod] = useState<PeriodKey>('alltime');
  const [investedInfoOpen, setInvestedInfoOpen] = useState(false);
  const [priceGainInfoOpen, setPriceGainInfoOpen] = useState(false);
  const [realizedGainInfoOpen, setRealizedGainInfoOpen] = useState(false);
  const [irrInfoOpen, setIrrInfoOpen] = useState(false);
  const [ttwrorInfoOpen, setTtwrorInfoOpen] = useState(false);
  const [averageReturnInfoOpen, setAverageReturnInfoOpen] = useState(false);
  const { selectedPortfolioId } = usePortfolioContext();
  const { data, realizedGains, cashFlows, years, isLoading } =
    usePortfolioPerformance('all', selectedPortfolioId ?? '');

  const periods = useMemo(() => buildPeriods(years), [years]);

  useEffect(() => {
    if (period !== 'alltime' && !years.includes(Number(period))) {
      setPeriod('alltime');
    }
  }, [years, period]);

  const endPoint = useMemo(() => periodEndPoint(data, period), [data, period]);
  const priceGainMetrics = useMemo(
    () => priceGainForPeriod(data, period),
    [data, period],
  );
  const realizedGainMetrics = useMemo(
    () => realizedGainForPeriod(realizedGains, period),
    [realizedGains, period],
  );
  const irrPercent = useMemo(
    () => irrForPeriod(data, cashFlows, period),
    [data, cashFlows, period],
  );
  const ttwrorPercent = useMemo(
    () => ttwrorForPeriod(data, cashFlows, period),
    [data, cashFlows, period],
  );
  const chartBars = useMemo(
    () => buildPerformanceChartBars(data, cashFlows, period, years),
    [data, cashFlows, period, years],
  );
  const averageReturnPercent = useMemo(
    () => averageReturnFromBars(chartBars),
    [chartBars],
  );

  const investedCapital = endPoint?.costBasis ?? null;
  const priceGain = priceGainMetrics?.gain ?? null;
  const priceGainPercent = priceGainMetrics?.percent ?? null;
  const realizedGain = realizedGainMetrics.gain;
  const realizedGainPercent = realizedGainMetrics.percent;
  const totalReturn = priceGain != null ? priceGain + realizedGain : null;
  const averageReturnPositive =
    averageReturnPercent == null || averageReturnPercent >= 0;

  if (!selectedPortfolioId) return null;

  return (
    <>
      <Box
        sx={{
          width: '100%',
          minWidth: 0,
          maxWidth: 720,
          mx: 'auto',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Stack spacing={2} sx={{ flexShrink: 0 }}>
          <PeriodSelector value={period} onChange={setPeriod} periods={periods} />

          <Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  color: MUTED,
                  textTransform: 'uppercase',
                }}
              >
                Chart
              </Typography>

              <ButtonBase
                onClick={() => setAverageReturnInfoOpen(true)}
                aria-label="About average return"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.25,
                  borderRadius: 1,
                  px: 0.25,
                  py: 0.15,
                }}
              >
                {isLoading || averageReturnPercent == null ? (
                  isLoading ? (
                    <Skeleton variant="text" width={64} height={22} />
                  ) : (
                    <Typography
                      sx={{ fontSize: 14, fontWeight: 600, color: MUTED }}
                    >
                      —
                    </Typography>
                  )
                ) : (
                  <Typography
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.35,
                      fontSize: 14,
                      fontWeight: 600,
                      color: averageReturnPositive ? GAIN_COLOR : LOSS_COLOR,
                    }}
                  >
                    <Box component="span" sx={{ fontSize: 15, lineHeight: 1 }}>
                      Ø
                    </Box>
                    {Math.abs(averageReturnPercent).toFixed(1)}%
                  </Typography>
                )}
                <InfoOutlinedIcon sx={{ fontSize: 16, color: MUTED }} />
              </ButtonBase>
            </Box>

            {isLoading ? (
              <Skeleton
                variant="rounded"
                height={240}
                sx={{ mt: 1, borderRadius: 2 }}
              />
            ) : (
              <PerformanceBarChart
                bars={chartBars}
                alternateLabels={period !== 'alltime'}
              />
            )}
          </Box>
        </Stack>

        <Stack
          spacing={3.5}
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehaviorY: 'contain',
            WebkitOverflowScrolling: 'touch',
            mt: 3.5,
            pb: 4,
          }}
        >
        <Box>
          <SectionTitle>Capital</SectionTitle>
          {isLoading ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 1.75,
                borderBottom: '1px solid',
                borderColor: 'rgba(0,0,0,0.06)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <Typography sx={{ fontSize: { xs: 15, sm: 16 }, fontWeight: 500, color: TEXT }}>
                  Invested capital
                </Typography>
                <IconButton
                  size="small"
                  aria-label="About Invested capital"
                  onClick={() => setInvestedInfoOpen(true)}
                  sx={{ color: MUTED, p: 0.35 }}
                >
                  <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
              <Skeleton variant="text" width={96} height={24} />
            </Box>
          ) : (
            <MetricRow
              label="Invested capital"
              value={formatUsd(investedCapital ?? 0)}
              onInfoClick={() => setInvestedInfoOpen(true)}
            />
          )}
        </Box>

        <Box>
          <SectionTitle>Performance breakdown</SectionTitle>
          {isLoading || priceGain == null || priceGainPercent == null ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 1.75,
                borderBottom: '1px solid',
                borderColor: 'rgba(0,0,0,0.06)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <Typography sx={{ fontSize: { xs: 15, sm: 16 }, fontWeight: 500, color: TEXT }}>
                  Price gain
                </Typography>
                <IconButton
                  size="small"
                  aria-label="About Price gain"
                  onClick={() => setPriceGainInfoOpen(true)}
                  sx={{ color: MUTED, p: 0.35 }}
                >
                  <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
              <Skeleton variant="text" width={140} height={24} />
            </Box>
          ) : (
            <MetricRow
              label="Price gain"
              percent={priceGainPercent}
              value={formatUsd(priceGain)}
              onInfoClick={() => setPriceGainInfoOpen(true)}
            />
          )}

          {isLoading ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 1.75,
                borderBottom: '1px solid',
                borderColor: 'rgba(0,0,0,0.06)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <Typography sx={{ fontSize: { xs: 15, sm: 16 }, fontWeight: 500, color: TEXT }}>
                  Realized gain
                </Typography>
                <IconButton
                  size="small"
                  aria-label="About Realized gain"
                  onClick={() => setRealizedGainInfoOpen(true)}
                  sx={{ color: MUTED, p: 0.35 }}
                >
                  <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
              <Skeleton variant="text" width={140} height={24} />
            </Box>
          ) : (
            <MetricRow
              label="Realized gain"
              percent={realizedGainPercent}
              value={formatUsd(realizedGain)}
              onInfoClick={() => setRealizedGainInfoOpen(true)}
            />
          )}

          <Box sx={{ mt: 0.5 }}>
            {isLoading || totalReturn == null ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 1.75,
                  borderBottom: '1px solid',
                  borderColor: 'rgba(0,0,0,0.06)',
                }}
              >
                <Typography sx={{ fontSize: { xs: 15, sm: 16 }, fontWeight: 700, color: TEXT }}>
                  Total return
                </Typography>
                <Skeleton variant="text" width={140} height={24} />
              </Box>
            ) : (
              <MetricRow
                label="Total return"
                value={formatUsd(totalReturn)}
                amount={totalReturn}
                bold
                showInfo={false}
              />
            )}
            {isLoading || irrPercent == null ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 1.75,
                  borderBottom: '1px solid',
                  borderColor: 'rgba(0,0,0,0.06)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <Typography sx={{ fontSize: { xs: 15, sm: 16 }, fontWeight: 500, color: TEXT }}>
                    Internal rate of return
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label="About Internal rate of return"
                    onClick={() => setIrrInfoOpen(true)}
                    sx={{ color: MUTED, p: 0.35 }}
                  >
                    <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
                {isLoading ? (
                  <Skeleton variant="text" width={72} height={24} />
                ) : (
                  <Typography sx={{ fontSize: { xs: 14, sm: 15 }, fontWeight: 600, color: MUTED }}>
                    —
                  </Typography>
                )}
              </Box>
            ) : (
              <MetricRow
                label="Internal rate of return"
                percent={irrPercent}
                onInfoClick={() => setIrrInfoOpen(true)}
              />
            )}
            {isLoading || ttwrorPercent == null ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 1.75,
                  borderBottom: '1px solid',
                  borderColor: 'rgba(0,0,0,0.06)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <Typography sx={{ fontSize: { xs: 15, sm: 16 }, fontWeight: 500, color: TEXT }}>
                    TTWROR
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label="About TTWROR"
                    onClick={() => setTtwrorInfoOpen(true)}
                    sx={{ color: MUTED, p: 0.35 }}
                  >
                    <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
                {isLoading ? (
                  <Skeleton variant="text" width={72} height={24} />
                ) : (
                  <Typography sx={{ fontSize: { xs: 14, sm: 15 }, fontWeight: 600, color: MUTED }}>
                    —
                  </Typography>
                )}
              </Box>
            ) : (
              <MetricRow
                label="TTWROR"
                percent={ttwrorPercent}
                onInfoClick={() => setTtwrorInfoOpen(true)}
              />
            )}
          </Box>
        </Box>
        </Stack>
      </Box>

      <MetricInfoSheet
        open={investedInfoOpen}
        title="Invested capital"
        description={INVESTED_CAPITAL_DEFINITION}
        onClose={() => setInvestedInfoOpen(false)}
      />
      <MetricInfoSheet
        open={priceGainInfoOpen}
        title="Price gain"
        description={PRICE_GAIN_DEFINITION}
        onClose={() => setPriceGainInfoOpen(false)}
      />
      <MetricInfoSheet
        open={realizedGainInfoOpen}
        title="Realized gain"
        description={REALIZED_GAIN_DEFINITION}
        onClose={() => setRealizedGainInfoOpen(false)}
      />
      <MetricInfoSheet
        open={irrInfoOpen}
        title="Internal rate of return"
        description={IRR_DEFINITION}
        onClose={() => setIrrInfoOpen(false)}
      />
      <MetricInfoSheet
        open={ttwrorInfoOpen}
        title="TTWROR"
        description={TTWROR_DEFINITION}
        onClose={() => setTtwrorInfoOpen(false)}
      />
      <MetricInfoSheet
        open={averageReturnInfoOpen}
        title="Average return"
        description={AVERAGE_RETURN_DEFINITION}
        onClose={() => setAverageReturnInfoOpen(false)}
      />
    </>
  );
};

export default PortfolioPerformance;
