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
  /** Chart window length ending at the newest bar (default 24h). */
  windowMs?: number;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
 * Mark portfolio value on a shared intraday grid using latest holdings.
 * Prices are forward-filled; the plotted window is the last ~24h ending at
 * the newest bar (overnight flat between sessions is intentional).
 */
export function computeIntradayPortfolioValue(
  holdings: Map<string, number>,
  costBasis: number,
  pricesByTicker: Map<string, StockBarWithDate[]>,
  options: IntradayPortfolioOptions = {},
): IntradayPortfolioPoint[] {
  const {
    tickerCurrency,
    ronToUsd = 0,
    convertRon = false,
    windowMs = ONE_DAY_MS,
  } = options;
  if (holdings.size === 0) return [];

  const heldTickers = [...holdings.keys()];
  const sortedBars = new Map<string, StockBarWithDate[]>();
  let maxT = 0;

  for (const ticker of heldTickers) {
    const bars = [...(pricesByTicker.get(ticker) ?? [])]
      .filter((bar) => Number.isFinite(bar.t) && bar.c > 0)
      .sort((left, right) => left.t - right.t);
    sortedBars.set(ticker, bars);
    if (bars.length > 0) {
      maxT = Math.max(maxT, bars[bars.length - 1].t);
    }
  }

  if (maxT <= 0) return [];

  const windowStart = maxT - windowMs;
  const timestampSet = new Set<number>();
  for (const bars of sortedBars.values()) {
    for (const bar of bars) {
      if (bar.t >= windowStart) timestampSet.add(bar.t);
    }
  }

  const timestamps = [...timestampSet].sort((a, b) => a - b);
  if (timestamps.length === 0) return [];

  const cursors = new Map<string, number>();
  const lastPrice = new Map<string, number>();
  for (const ticker of heldTickers) {
    cursors.set(ticker, 0);
    // Seed with the last print at or before the window so equity stays marked overnight.
    const bars = sortedBars.get(ticker) ?? [];
    let seedPrice: number | undefined;
    for (const bar of bars) {
      if (bar.t > windowStart) break;
      seedPrice = bar.c;
    }
    if (seedPrice !== undefined) lastPrice.set(ticker, seedPrice);
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
      const price = lastPrice.get(ticker);
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

function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}
