/**
 * Cash-flow point used to build a time-weighted performance series.
 * `costBasis` deltas approximate external capital flows (buys/sells).
 */
export type PerformanceInputPoint = {
  date?: string;
  value: number;
  costBasis: number;
};

/** External flow into the portfolio (positive = deposit / buy, negative = withdrawal / sell). */
export type ExternalFlowPoint = {
  date: string;
  /** Signed flow into the portfolio. */
  amount: number;
};

/** Ignore return math below this notional — tiny bases explode TWR. */
const MIN_RETURN_BASE = 1;

/**
 * Daily moves beyond this without a matching cash flow are treated as price-data
 * discontinuities (history starting mid-hold, bad prints, etc.), not performance.
 *
 * Keep this well below 100%: a −80% bad tick that later recovers +400% would
 * otherwise book the crash and clamp the recovery, permanently dragging TTWROR.
 */
const MAX_UNEXPLAINED_DAILY_RETURN = 0.5; // ±50%

function resolveFlow(
  curr: PerformanceInputPoint,
  prev: PerformanceInputPoint,
  flowsByDate: Map<string, number> | null,
): number {
  const costFlow = curr.costBasis - prev.costBasis;
  // No explicit flows — approximate with cost-basis deltas (buys only; sells
  // use lot cost rather than proceeds).
  if (!flowsByDate || !curr.date) return costFlow;

  // When buy/sell notionals are provided, trust them only. Falling back to
  // cost-basis growth mis-treats FX marks on RON lots as fresh deposits and
  // systematically depresses TWR.
  return flowsByDate.get(curr.date) ?? 0;
}

function dailyReturnForStep(
  prev: PerformanceInputPoint,
  curr: PerformanceInputPoint,
  flow: number,
): number {
  const inflow = Math.max(flow, 0);
  const outflow = Math.max(-flow, 0);
  const beginningValue = prev.value + inflow;
  const endingValue = curr.value + outflow;

  if (beginningValue < MIN_RETURN_BASE) return 0;

  let dailyReturn = endingValue / beginningValue - 1;
  if (!Number.isFinite(dailyReturn)) return 0;

  // Price history gaps create one-day portfolio jumps with little/no flow.
  const valueDelta = Math.abs(curr.value - prev.value);
  const flowExplains =
    valueDelta < MIN_RETURN_BASE || Math.abs(flow) >= valueDelta * 0.5;
  if (!flowExplains && Math.abs(dailyReturn) > MAX_UNEXPLAINED_DAILY_RETURN) {
    return 0;
  }

  return dailyReturn;
}

/**
 * Builds a time-weighted performance index from a raw portfolio value series.
 *
 * Prefer `externalFlows` (true buy/sell notionals). When omitted, falls back to
 * cost-basis deltas — accurate for buys, but wrong for sells (uses lot cost
 * instead of proceeds).
 *
 * Cash-flow timing (Portfolio Performance / GIPS-style):
 *   inflows at start of day, outflows at end of day
 *   1 + r_t = (V_t + outflow) / (V_{t−1} + inflow)
 */
export function buildTimeWeightedSeries<T extends PerformanceInputPoint>(
  points: T[],
  externalFlows?: ExternalFlowPoint[],
): Array<T & { performanceValue: number }> {
  if (points.length === 0) return [];

  const flowsByDate =
    externalFlows && externalFlows.length > 0 ? new Map<string, number>() : null;
  if (flowsByDate && externalFlows) {
    for (const flow of externalFlows) {
      flowsByDate.set(flow.date, (flowsByDate.get(flow.date) ?? 0) + flow.amount);
    }
  }

  let performanceValue = points[0].value;
  const result: Array<T & { performanceValue: number }> = [
    { ...points[0], performanceValue },
  ];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const flow = resolveFlow(curr, prev, flowsByDate);
    const dailyReturn = dailyReturnForStep(prev, curr, flow);

    const next = performanceValue * (1 + dailyReturn);
    performanceValue = Number.isFinite(next) ? next : performanceValue;

    result.push({ ...curr, performanceValue });
  }

  return result;
}

function prepareTtwrorPoints(
  points: Array<{ date: string; value: number; costBasis: number }>,
  cashFlows: Array<{ date: string; amount: number }>,
): {
  seriesPoints: Array<{ date: string; value: number; costBasis: number }>;
  externalFlows: ExternalFlowPoint[];
} | null {
  if (points.length === 0) return null;

  let startIdx = 0;
  while (
    startIdx < points.length - 1 &&
    points[startIdx].value < MIN_RETURN_BASE &&
    points[startIdx].costBasis < MIN_RETURN_BASE
  ) {
    startIdx++;
  }
  const seriesPoints = startIdx === 0 ? [...points] : points.slice(startIdx);
  if (seriesPoints.length === 0) return null;

  // Do NOT rewrite an underwater opening mark up to costBasis here.
  // That was meant for true inception, but year/month windows prepend the prior
  // day — rewriting it books earlier drawdowns into the selected period and
  // paints every underwater month red. Buy-day pricing in `buildPriceMatrix`
  // already aligns inception capital with cash deployed.

  const startDate = seriesPoints[0].date;
  const externalFlows = cashFlows
    .filter((cf) => cf.date > startDate)
    .map((cf) => ({
      date: cf.date,
      amount: -cf.amount,
    }));

  return { seriesPoints, externalFlows };
}

/**
 * Cumulative true time-weighted return % for a value series.
 * `cashFlows` use XIRR sign convention: buy = −notional, sell = +proceeds.
 */
export function computeTtwrorPercent(
  points: Array<{ date: string; value: number; costBasis: number }>,
  cashFlows: Array<{ date: string; amount: number }> = [],
): number | null {
  const prepared = prepareTtwrorPoints(points, cashFlows);
  if (!prepared) return null;
  if (prepared.seriesPoints.length < 2) return 0;

  const series = toCumulativeReturnPercent(
    buildTimeWeightedSeries(prepared.seriesPoints, prepared.externalFlows),
  );
  return series[series.length - 1]?.returnPercent ?? null;
}

/** Breakdown of the largest daily TWR contributors — useful when all-time looks absurd. */
export function diagnoseTtwror(
  points: Array<{ date: string; value: number; costBasis: number }>,
  cashFlows: Array<{ date: string; amount: number }> = [],
): {
  returnPercent: number;
  startDate: string;
  endDate: string;
  topDays: Array<{ date: string; dailyReturnPct: number; value: number; flow: number }>;
} | null {
  const prepared = prepareTtwrorPoints(points, cashFlows);
  if (!prepared) return null;

  const { seriesPoints, externalFlows } = prepared;
  if (seriesPoints.length < 2) {
    return {
      returnPercent: 0,
      startDate: seriesPoints[0]?.date ?? '',
      endDate: seriesPoints[0]?.date ?? '',
      topDays: [],
    };
  }

  const flowsByDate = new Map<string, number>();
  for (const flow of externalFlows) {
    flowsByDate.set(flow.date, (flowsByDate.get(flow.date) ?? 0) + flow.amount);
  }

  const dayReturns: Array<{
    date: string;
    dailyReturnPct: number;
    value: number;
    flow: number;
  }> = [];

  for (let i = 1; i < seriesPoints.length; i++) {
    const prev = seriesPoints[i - 1];
    const curr = seriesPoints[i];
    const flow = resolveFlow(curr, prev, flowsByDate);
    const dailyReturn = dailyReturnForStep(prev, curr, flow);

    if (Math.abs(dailyReturn) > 0.05) {
      dayReturns.push({
        date: curr.date,
        dailyReturnPct: dailyReturn * 100,
        value: curr.value,
        flow,
      });
    }
  }

  dayReturns.sort((a, b) => Math.abs(b.dailyReturnPct) - Math.abs(a.dailyReturnPct));

  const returnPercent = computeTtwrorPercent(points, cashFlows) ?? 0;

  return {
    returnPercent,
    startDate: seriesPoints[0].date,
    endDate: seriesPoints[seriesPoints.length - 1].date,
    topDays: dayReturns.slice(0, 10),
  };
}

/**
 * Converts a TWR index series to cumulative return % vs the first point (0% = period start).
 */
export function toCumulativeReturnPercent<T extends { performanceValue: number }>(
  points: T[],
): Array<T & { returnPercent: number }> {
  if (points.length === 0) return [];

  const start = points[0].performanceValue;
  return points.map((p) => ({
    ...p,
    returnPercent: start > 1e-9 ? ((p.performanceValue / start) - 1) * 100 : 0,
  }));
}

/**
 * Return vs invested capital: (market value / cost basis - 1) × 100.
 * 0% = break-even on money invested.
 */
export function returnOnCostPercent(value: number, costBasis: number): number {
  if (costBasis <= 1e-9) return 0;
  const pct = ((value - costBasis) / costBasis) * 100;
  return Number.isFinite(pct) ? pct : 0;
}
