import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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
const CHART_MARGIN = { top: 22, right: 4, left: 4, bottom: 4 };

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

function findNearestPoint(
  chartData: PortfolioChartPoint[],
  clientX: number,
  container: HTMLElement | null,
): { point: PortfolioChartPoint; index: number } | null {
  if (!container || chartData.length === 0) return null;

  const rect = container.getBoundingClientRect();
  const plotWidth = rect.width - CHART_MARGIN.left - CHART_MARGIN.right;
  if (plotWidth <= 0) return null;

  const ratio = Math.max(
    0,
    Math.min(1, (clientX - rect.left - CHART_MARGIN.left) / plotWidth),
  );
  const tMin = chartData[0].t;
  const tMax = chartData[chartData.length - 1].t;
  const targetT = tMin + ratio * (tMax - tMin);

  let lo = 0;
  let hi = chartData.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (chartData[mid].t < targetT) lo = mid + 1;
    else hi = mid;
  }

  const index =
    lo > 0 &&
    Math.abs(chartData[lo - 1].t - targetT) <= Math.abs(chartData[lo].t - targetT)
      ? lo - 1
      : lo;

  return { point: chartData[index], index };
}

export default function PortfolioChart({ chartData, positive, domain, onScrub }: Props) {
  const stroke = positive ? GAIN_COLOR : LOSS_COLOR;
  const baseline = chartData.length > 0 ? chartData[0].close : 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const touchScrubbingRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // Avoid mounting ResponsiveContainer at the default -1/-1 size (console warnings).
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      const next = { width: Math.round(width), height: Math.round(height) };
      setContainerSize((prev) =>
        prev?.width === next.width && prev?.height === next.height ? prev : next,
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const clearScrub = useCallback(() => {
    touchScrubbingRef.current = false;
    setActiveIndex(null);
    onScrub?.(null);
  }, [onScrub]);

  const scrubAtClientX = useCallback(
    (clientX: number) => {
      const nearest = findNearestPoint(chartData, clientX, containerRef.current);
      if (!nearest) return;

      setActiveIndex((prev) => (prev === nearest.index ? prev : nearest.index));
      onScrub?.(nearest.point);
    },
    [chartData, onScrub],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;

    touchScrubbingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    scrubAtClientX(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      if (!touchScrubbingRef.current) return;
      scrubAtClientX(event.clientX);
      return;
    }

    // Mouse: scrub while hovering.
    scrubAtClientX(event.clientX);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;
    clearScrub();
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;
    clearScrub();
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Touch leave is handled by pointer capture + pointerup/cancel.
    if (event.pointerType === 'touch') return;
    clearScrub();
  };

  return (
    <div
      ref={containerRef}
      className="portfolio-chart"
      data-no-pull-refresh
      style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
    >
      {containerSize ? (
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        initialDimension={containerSize}
      >
        <LineChart
          data={chartData}
          margin={CHART_MARGIN}
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
            active={activeIndex != null}
            defaultIndex={activeIndex ?? undefined}
            wrapperStyle={{ outline: 'none' }}
          />

          <Line
            type="monotone"
            dataKey="close"
            stroke={stroke}
            strokeWidth={2.25}
            dot={false}
            // Recharts can keep an internal active index after touch-up; only render
            // the scrubber dot while we are actively scrubbing.
            activeDot={
              activeIndex != null
                ? {
                    r: 4,
                    fill: stroke,
                    stroke: '#fff',
                    strokeWidth: 2,
                  }
                : false
            }
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      ) : null}
    </div>
  );
}
