import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatNumber, formatTimestamp } from './stockDashboard.types';

export type PortfolioChartPoint = {
  t: number;
  close: number;
  costBasis: number;
};

type Props = {
  chartData: PortfolioChartPoint[];
  xAxisTickFormatter: (value: number) => string;
  yAxisScale: { ticks: number[]; domain: [number, number] };
};

function abbreviateDollar(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export default function PortfolioChart({ chartData, xAxisTickFormatter, yAxisScale }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 16, right: 20, left: 8, bottom: 16 }}>
        <defs>
          <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-portfolio-value)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--color-portfolio-value)" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid
          stroke="var(--color-border-3)"
          horizontal={true}
          vertical={false}
        />

        <XAxis
          dataKey="t"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={xAxisTickFormatter}
          tick={{ fill: 'var(--color-text-3)', fontSize: 11 }}
          tickMargin={10}
          minTickGap={40}
          axisLine={false}
          tickLine={false}
        />

        <YAxis
          ticks={yAxisScale.ticks}
          domain={yAxisScale.domain}
          tick={{ fill: 'var(--color-text-3)', fontSize: 11 }}
          tickFormatter={abbreviateDollar}
          width={64}
          axisLine={false}
          tickLine={false}
        />

        <Tooltip
          formatter={(value, name) => [
            `$${formatNumber(Number(value ?? 0))}`,
            name === 'close' ? 'Portfolio Value' : 'Cost Basis',
          ]}
          labelFormatter={(label) =>
            formatTimestamp(Number(label ?? 0), {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          }
          contentStyle={{
            borderRadius: '10px',
            border: '1px solid var(--color-border-3)',
            boxShadow: `0 2px 8px var(--color-shadow)`,
            background: 'var(--color-surface-raised)',
          }}
          cursor={{ stroke: 'var(--color-border-2)', strokeWidth: 1 }}
        />

        <Area
          type="monotone"
          dataKey="close"
          stroke="var(--color-portfolio-value)"
          strokeWidth={2}
          fill="url(#portfolioFill)"
          dot={false}
          isAnimationActive={false}
        />

        <Line
          type="monotone"
          dataKey="costBasis"
          stroke="var(--color-portfolio-cost)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
