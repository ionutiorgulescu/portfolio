import { Currency } from '../types/positions';
import type { StockBarWithDate } from '../hooks/useStockData';

export type IntradayPortfolioPoint = {
  t: number;
  date: string;
  value: number;
  costBasis: number;
};

export type IntradayPortfolioOptions = {
  tickerCurrency?: Map<string, Currency>;
  ronToUsd?: number;
  convertRon?: boolean;
  /** Session open (inclusive). */
  windowStart: number;
  /** Last plotted timestamp: min(now, session close). */
  windowEnd: number;
  /**
   * Quote / buy price when a ticker has no session bars yet
   * (same-day BVB lots, missing Yahoo history).
   */
  seedPrices?: Map<string, number>;
  /** Remaining lot cost (native) — last-resort mark when no quote exists. */
  tickerCost?: Map<string, number>;
};

/**
 * Keep each ticker's latest session calendar day.
 * Useful for single-ticker 1D charts (Market page).
 */
export function takeLatestSessionBars(
  pricesByTicker: Map<string, StockBarWithDate[]>,
): Map<string, StockBarWithDate[]> {
  const filtered = new Map<string, StockBarWithDate[]>();

  for (const [ticker, bars] of pricesByTicker) {
    let latestDate = '';
    for (const bar of bars) {
      if (bar.date > latestDate) latestDate = bar.date;
    }
    filtered.set(
      ticker,
      latestDate ? bars.filter((bar) => bar.date === latestDate) : [],
    );
  }

  return filtered;
}

/**
 * Mark portfolio value at session open, each real print, and `windowEnd`.
 * Prices are forward-filled across tickers. Do not synthesize a 5m grid —
 * that paints a flat previous-close line and a vertical jump to the live tip.
 */
export function computeIntradayPortfolioValue(
  holdings: Map<string, number>,
  costBasis: number,
  pricesByTicker: Map<string, StockBarWithDate[]>,
  options: IntradayPortfolioOptions,
): IntradayPortfolioPoint[] {
  const {
    tickerCurrency,
    ronToUsd = 0,
    convertRon = false,
    windowStart,
    windowEnd,
    seedPrices,
    tickerCost,
  } = options;
  if (holdings.size === 0 || !(windowEnd >= windowStart)) return [];

  const heldTickers = [...holdings.keys()];
  const sortedBars = new Map<string, StockBarWithDate[]>();
  let hasAnyBar = false;
  let hasAnySeed = false;

  for (const ticker of heldTickers) {
    const bars = [...(pricesByTicker.get(ticker) ?? [])]
      .filter((bar) => Number.isFinite(bar.t) && bar.c > 0)
      .sort((left, right) => left.t - right.t);
    sortedBars.set(ticker, bars);
    if (bars.length > 0) hasAnyBar = true;

    const seed = seedPriceFor(ticker, holdings.get(ticker) ?? 0, seedPrices, tickerCost);
    if (seed !== undefined) hasAnySeed = true;
  }

  if (!hasAnyBar && !hasAnySeed) return [];

  const timestampSet = new Set<number>([windowStart, windowEnd]);
  for (const bars of sortedBars.values()) {
    for (const bar of bars) {
      if (bar.t >= windowStart && bar.t <= windowEnd) timestampSet.add(bar.t);
    }
  }

  const timestamps = [...timestampSet].sort((a, b) => a - b);

  const cursors = new Map<string, number>();
  const lastPrice = new Map<string, number>();
  for (const ticker of heldTickers) {
    cursors.set(ticker, 0);
    // Seed with the last print at or before the open so the line starts at the left.
    const bars = sortedBars.get(ticker) ?? [];
    let seedPrice: number | undefined;
    for (const bar of bars) {
      if (bar.t > windowStart) break;
      seedPrice = bar.c;
    }
    if (seedPrice !== undefined) {
      lastPrice.set(ticker, seedPrice);
    } else {
      const fallback = seedPriceFor(
        ticker,
        holdings.get(ticker) ?? 0,
        seedPrices,
        tickerCost,
      );
      if (fallback !== undefined) lastPrice.set(ticker, fallback);
    }
  }

  const result: IntradayPortfolioPoint[] = [];

  for (const t of timestamps) {
    for (const ticker of heldTickers) {
      const bars = sortedBars.get(ticker) ?? [];
      let index = cursors.get(ticker) ?? 0;
      while (index < bars.length && bars[index].t <= t) {
        lastPrice.set(ticker, bars[index].c);
        index += 1;
      }
      cursors.set(ticker, index);
    }

    let totalValue = 0;
    let pricedAny = false;

    for (const [ticker, shares] of holdings) {
      let price = lastPrice.get(ticker);
      if (price === undefined || price <= 0) {
        price = seedPriceFor(ticker, shares, seedPrices, tickerCost);
      }
      if (price === undefined || price <= 0) continue;

      const currency = tickerCurrency?.get(ticker);
      const fx = convertRon && currency === Currency.RON ? ronToUsd : 1;
      if (convertRon && currency === Currency.RON && !(ronToUsd > 0)) continue;

      totalValue += shares * price * fx;
      pricedAny = true;
    }

    if (!pricedAny) continue;

    result.push({
      t,
      date: formatDate(t),
      value: totalValue,
      costBasis,
    });
  }

  return result;
}

function seedPriceFor(
  ticker: string,
  shares: number,
  seedPrices?: Map<string, number>,
  tickerCost?: Map<string, number>,
): number | undefined {
  const quoted = seedPrices?.get(ticker);
  if (quoted !== undefined && quoted > 0) return quoted;

  const cost = tickerCost?.get(ticker);
  if (cost !== undefined && cost > 0 && shares > 0) return cost / shares;

  return undefined;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}
