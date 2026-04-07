import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatNumber, formatTimestamp } from '../stockMarket.types';
import type { ChartPoint } from '../stockMarket.types';

type Props = {
  chartData: ChartPoint[];
  xAxisTickFormatter: (value: number) => string;
  yAxisScale: { ticks: number[]; domain: [number, number] };
};

export default function StockChart({ chartData, xAxisTickFormatter, yAxisScale }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 16, right: 20, left: 8, bottom: 16 }}>
        <CartesianGrid stroke="#ececec" horizontal vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={xAxisTickFormatter}
          tick={{ fill: '#6b7280', fontSize: 12 }}
          tickMargin={10}
          minTickGap={24}
        />
        <YAxis
          ticks={yAxisScale.ticks}
          domain={yAxisScale.domain}
          tick={{ fill: '#6b7280', fontSize: 12 }}
          tickFormatter={(value: number) => `$${formatNumber(value)}`}
          width={90}
        />
        <Tooltip
          formatter={(value) => [`$${formatNumber(Number(value ?? 0))}`, 'Close']}
          labelFormatter={(label) =>
            formatTimestamp(Number(label ?? 0), {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          }
          contentStyle={{ borderRadius: '10px', border: '1px solid #f0f0f0' }}
        />
        <Area
          type="monotone"
          dataKey="close"
          stroke="#e08692"
          strokeWidth={2}
          fill="#F4A7B0"
          fillOpacity={0.85}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
