/**
 * Cash-flow point used to build a time-weighted performance series.
 * `costBasis` deltas approximate external capital flows (buys/sells).
 */
export type PerformanceInputPoint = {
  value: number;
  costBasis: number;
};

/** Ignore return math below this notional — tiny bases explode TWR. */
const MIN_RETURN_BASE = 1;

/**
 * Builds a time-weighted performance index from a raw portfolio value series.
 *
 * Each day's market return excludes estimated external flows:
 *   r_t = (V_t - V_{t-1} - ΔcostBasis) / V_{t-1}
 * The index compounds those returns from the period's starting market value.
 */
export function buildTimeWeightedSeries<T extends PerformanceInputPoint>(
  points: T[],
): Array<T & { performanceValue: number }> {
  if (points.length === 0) return [];

  let performanceValue = points[0].value;
  const result: Array<T & { performanceValue: number }> = [
    { ...points[0], performanceValue },
  ];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const flow = curr.costBasis - prev.costBasis;

    let dailyReturn = 0;
    if (prev.value >= MIN_RETURN_BASE) {
      dailyReturn = (curr.value - prev.value - flow) / prev.value;
      if (!Number.isFinite(dailyReturn)) dailyReturn = 0;
    }

    const next = performanceValue * (1 + dailyReturn);
    performanceValue = Number.isFinite(next) ? next : performanceValue;

    result.push({ ...curr, performanceValue });
  }

  return result;
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
