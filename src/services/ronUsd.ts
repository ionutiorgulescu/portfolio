import type { StockBarWithDate } from '../hooks/useStockData';

/**
 * Builds a calendar-day RON→USD rate series with forward/backward fill.
 * Optional `liveRate` overrides the latest date so today's mark matches spot.
 */
export function buildRonUsdSeries(
  bars: StockBarWithDate[],
  dateRange: string[],
  liveRate?: number,
): Map<string, number> {
  const series = new Map<string, number>();
  if (dateRange.length === 0) return series;

  const raw = new Map<string, number>();
  for (const bar of bars) {
    if (Number.isFinite(bar.c) && bar.c > 0) {
      raw.set(bar.date, bar.c);
    }
  }

  let lastKnown: number | null = null;
  for (const date of dateRange) {
    const market = raw.get(date);
    if (market !== undefined) lastKnown = market;
    if (lastKnown !== null) series.set(date, lastKnown);
  }

  let nextKnown: number | null = null;
  for (let i = dateRange.length - 1; i >= 0; i--) {
    const date = dateRange[i];
    const existing = series.get(date);
    if (existing !== undefined) {
      nextKnown = existing;
    } else if (nextKnown !== null) {
      series.set(date, nextKnown);
    }
  }

  if (liveRate != null && liveRate > 0) {
    if (series.size === 0) {
      // No FX history — use spot for every day rather than leaving gaps.
      for (const date of dateRange) series.set(date, liveRate);
    } else {
      series.set(dateRange[dateRange.length - 1], liveRate);
    }
  }

  return series;
}

/** FX for a date, else nearest earlier/later rate, else `fallback`. */
export function ronUsdOnDate(
  series: Map<string, number> | null | undefined,
  date: string,
  fallback = 0,
): number {
  if (!series || series.size === 0) return fallback;

  const exact = series.get(date);
  if (exact != null && exact > 0) return exact;

  let bestBefore: string | null = null;
  let bestAfter: string | null = null;
  for (const key of series.keys()) {
    if (key <= date && (bestBefore === null || key > bestBefore)) {
      bestBefore = key;
    }
    if (key >= date && (bestAfter === null || key < bestAfter)) {
      bestAfter = key;
    }
  }

  if (bestBefore != null) {
    const rate = series.get(bestBefore);
    if (rate != null && rate > 0) return rate;
  }
  if (bestAfter != null) {
    const rate = series.get(bestAfter);
    if (rate != null && rate > 0) return rate;
  }

  return fallback;
}
