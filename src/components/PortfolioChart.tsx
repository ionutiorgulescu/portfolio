import { useState } from 'react';
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MouseHandlerDataParam } from 'recharts';
import type { TooltipContentProps } from 'recharts/types/component/Tooltip';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { formatChartCursorDate } from './stockMarket.types';

export type PortfolioChartPoint = {
  t: number;
  close: number;
  costBasis: number;
};

type Props = {
  chartData: PortfolioChartPoint[];
  positive: boolean;
  domain: [number, number];
  onScrub?: (point: PortfolioChartPoint | null) => void;
};

const GAIN_COLOR = '#27a69a';
const LOSS_COLOR = '#d92673';
const BASELINE_COLOR = '#d1d5db';
const CURSOR_COLOR = '#c4c4c4';

function DateCursorTooltip({ active, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || label == null) return null;

  return (
    <div
      style={{
        color: '#9ca3af',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
        pointerEvents: 'none',
      }}
    >
      {formatChartCursorDate(Number(label))}
    </div>
  );
}

function resolveActivePoint(
  chartData: PortfolioChartPoint[],
  state: MouseHandlerDataParam,
): PortfolioChartPoint | null {
  if (!state.isTooltipActive) return null;

  const index =
    typeof state.activeTooltipIndex === 'number'
      ? state.activeTooltipIndex
      : typeof state.activeIndex === 'number'
        ? state.activeIndex
        : -1;

  if (index >= 0 && index < chartData.length) {
    return chartData[index];
  }

  if (state.activeLabel != null) {
    const t = Number(state.activeLabel);
    return chartData.find((p) => p.t === t) ?? null;
  }

  return null;
}

export default function PortfolioChart({ chartData, positive, domain, onScrub }: Props) {
  const stroke = positive ? GAIN_COLOR : LOSS_COLOR;
  const baseline = chartData.length > 0 ? chartData[0].close : 0;
  // Bumping this remounts the chart so Recharts clears sticky touch tooltip/cursor state.
  const [interactionKey, setInteractionKey] = useState(0);

  const updateScrub = (state: MouseHandlerDataParam) => {
    onScrub?.(resolveActivePoint(chartData, state));
  };

  const endScrub = () => {
    onScrub?.(null);
  };

  const endTouchScrub = () => {
    onScrub?.(null);
    setInteractionKey((key) => key + 1);
  };

  return (
    <div className="portfolio-chart" style={{ width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          key={interactionKey}
          data={chartData}
          margin={{ top: 22, right: 4, left: 4, bottom: 4 }}
          onMouseMove={updateScrub}
          onMouseLeave={endScrub}
          onTouchStart={updateScrub}
          onTouchMove={updateScrub}
          onTouchEnd={endTouchScrub}
        >
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            hide
          />
          <YAxis domain={domain} hide />

          <ReferenceLine
            y={baseline}
            stroke={BASELINE_COLOR}
            strokeDasharray="3 4"
            strokeWidth={1}
            ifOverflow="extendDomain"
          />

          <Tooltip
            content={DateCursorTooltip}
            cursor={{ stroke: CURSOR_COLOR, strokeWidth: 1 }}
            allowEscapeViewBox={{ x: true, y: true }}
            position={{ y: 0 }}
            isAnimationActive={false}
            wrapperStyle={{ outline: 'none' }}
          />

          <Line
            type="monotone"
            dataKey="close"
            stroke={stroke}
            strokeWidth={2.25}
            dot={false}
            activeDot={{
              r: 4,
              fill: stroke,
              stroke: '#fff',
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
