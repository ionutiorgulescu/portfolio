import {
  useCallback,
  useLayoutEffect,
  useMemo,
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
import { formatChartCursorDate, formatChartCursorTime } from './stockMarket.types';

export type PortfolioChartPoint = {
  t: number;
  /** Return on cost % (plotted; 0 = break-even vs money invested). */
  close: number;
  /** Actual portfolio market value (Total Value display). */
  rawValue: number;
  costBasis: number;
};

type Props = {
  chartData: PortfolioChartPoint[];
  positive: boolean;
  domain: [number, number];
  /** Explicit x range so 1D can span the session (open → close) with empty time after now. */
  xDomain?: [number, number];
  /** Unix ms for the vertical Live marker (typically "now"). */
  liveAt?: number;
  /** Break-even reference (0% for return charts). */
  baseline?: number;
  showBaseline?: boolean;
  onScrub?: (point: PortfolioChartPoint | null) => void;
  /** Cursor label: calendar date (default) or clock time for 1D. */
  cursorFormat?: 'date' | 'time';
  /** `linear` matches a session sparkline; `monotone` is smoother for longer ranges. */
  lineType?: 'monotone' | 'linear';
};

const GAIN_COLOR = '#27a69a';
const LOSS_COLOR = '#d92673';
const BASELINE_COLOR = '#d1d5db';
const CURSOR_COLOR = '#c4c4c4';
const CHART_MARGIN = { top: 22, right: 4, left: 4, bottom: 4 };

function DateCursorTooltip({
  active,
  label,
  cursorFormat = 'date',
  liveAt,
}: TooltipContentProps<ValueType, NameType> & {
  cursorFormat?: 'date' | 'time';
  liveAt?: number;
}) {
  if (!active || label == null) return null;

  const isLive = liveAt != null && Number(label) === liveAt;
  const text = isLive
    ? 'Live'
    : cursorFormat === 'time'
      ? formatChartCursorTime(Number(label))
      : formatChartCursorDate(Number(label));

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
      {text}
    </div>
  );
}

function findNearestPoint(
  chartData: PortfolioChartPoint[],
  clientX: number,
  container: HTMLElement | null,
  xDomain?: [number, number],
): { point: PortfolioChartPoint; index: number } | null {
  if (!container || chartData.length === 0) return null;

  const rect = container.getBoundingClientRect();
  const plotWidth = rect.width - CHART_MARGIN.left - CHART_MARGIN.right;
  if (plotWidth <= 0) return null;

  const ratio = Math.max(
    0,
    Math.min(1, (clientX - rect.left - CHART_MARGIN.left) / plotWidth),
  );
  const tMin = xDomain?.[0] ?? chartData[0].t;
  const tMax = xDomain?.[1] ?? chartData[chartData.length - 1].t;
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

export default function PortfolioChart({
  chartData,
  positive,
  domain,
  xDomain,
  liveAt,
  baseline = 0,
  showBaseline = true,
  onScrub,
  cursorFormat = 'date',
  lineType = 'monotone',
}: Props) {
  const stroke = positive ? GAIN_COLOR : LOSS_COLOR;
  const plotData = useMemo(() => {
    if (!xDomain || chartData.length === 0) return chartData;
    const last = chartData[chartData.length - 1];
    if (last.t >= xDomain[1]) return chartData;
    // Invisible future point so the x-axis extends from "now" to session close.
    return [...chartData, { ...last, t: xDomain[1], close: Number.NaN }];
  }, [chartData, xDomain]);
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
      const nearest = findNearestPoint(chartData, clientX, containerRef.current, xDomain);
      if (!nearest) return;

      setActiveIndex((prev) => (prev === nearest.index ? prev : nearest.index));
      onScrub?.(nearest.point);
    },
    [chartData, onScrub, xDomain],
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
          data={plotData}
          margin={CHART_MARGIN}
        >
          <XAxis
            dataKey="t"
            type="number"
            scale="linear"
            domain={xDomain ?? ['dataMin', 'dataMax']}
            hide
          />
          <YAxis domain={domain} hide />

          {showBaseline ? (
            <ReferenceLine
              y={baseline}
              stroke={BASELINE_COLOR}
              strokeDasharray="3 4"
              strokeWidth={1}
              ifOverflow="extendDomain"
            />
          ) : null}

          <Tooltip
            content={(props) => (
              <DateCursorTooltip
                {...props}
                cursorFormat={cursorFormat}
                liveAt={liveAt}
              />
            )}
            cursor={{ stroke: CURSOR_COLOR, strokeWidth: 1 }}
            allowEscapeViewBox={{ x: true, y: true }}
            position={{ y: 0 }}
            isAnimationActive={false}
            active={activeIndex != null}
            defaultIndex={activeIndex ?? undefined}
            wrapperStyle={{ outline: 'none' }}
          />

          <Line
            type={lineType}
            dataKey="close"
            stroke={stroke}
            strokeWidth={lineType === 'linear' ? 2 : 2.25}
            dot={
              chartData.length < 2
                ? { r: 4, fill: stroke, stroke: '#fff', strokeWidth: 2 }
                : false
            }
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
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
      ) : null}
    </div>
  );
}
