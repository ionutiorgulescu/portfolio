import type { StockBarWithDate } from '../hooks/useStockData';
import type { PriceMatrix } from '../types/performance';

/** Buy-price seeds used on purchase dates and when a ticker has no market history. */
export type PriceSeed = { date: string; price: number };

/**
 * Builds a `PriceMatrix` from a map of per-ticker historical bar arrays.
 *
 * For each ticker:
 * 1. Place raw closing prices on trade dates (forward-filled for gaps)
 * 2. Backward-fill before the first trade with that first close
 * 3. On purchase dates, prefer the transaction buy price over the market close
 *
 * Step 3 matters for TTWROR: if the series starts on a buy date valued at a
 * distressed EOD close while cost is much higher, the same-day mark-to-market
 * loss is never counted (no prior point) but the later recovery is — which
 * massively overstates all-time TWR. Valuing buys at trade price keeps the
 * opening capital aligned with cash deployed.
 *
 * Buy seeds also cover tickers with no market bars at all.
 */
export function buildPriceMatrix(
  pricesByTicker: Map<string, StockBarWithDate[]>,
  dateRange: string[],
  buySeeds?: Map<string, PriceSeed[]>,
): PriceMatrix {
  const matrix: PriceMatrix = new Map();

  const tickers = new Set<string>([
    ...pricesByTicker.keys(),
    ...(buySeeds?.keys() ?? []),
  ]);

  for (const ticker of tickers) {
    const bars = pricesByTicker.get(ticker) ?? [];
    const rawPrices = new Map<string, number>();
    for (const bar of bars) {
      if (Number.isFinite(bar.c) && bar.c > 0) {
        rawPrices.set(bar.date, bar.c);
      }
    }

    const seeds = [...(buySeeds?.get(ticker) ?? [])].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    );
    const buyPriceByDate = new Map<string, number>();
    for (const seed of seeds) {
      if (seed.price > 0) {
        // Last buy on that date wins (adequate for same-day multiples).
        buyPriceByDate.set(seed.date, seed.price);
      }
    }

    const tickerPrices = new Map<string, number>();

    if (rawPrices.size > 0) {
      let lastKnownPrice: number | null = null;
      for (const date of dateRange) {
        const marketPrice = rawPrices.get(date);
        if (marketPrice !== undefined) {
          lastKnownPrice = marketPrice;
        }

        const buyPrice = buyPriceByDate.get(date);
        if (buyPrice !== undefined) {
          // Purchase day: value at trade price (matches cash deployed / cost).
          tickerPrices.set(date, buyPrice);
          if (lastKnownPrice === null) lastKnownPrice = buyPrice;
        } else if (marketPrice !== undefined) {
          tickerPrices.set(date, marketPrice);
        } else if (lastKnownPrice !== null) {
          tickerPrices.set(date, lastKnownPrice);
        }
      }

      // Backward-fill only dates still empty before first known price
      let nextKnownPrice: number | null = null;
      for (let i = dateRange.length - 1; i >= 0; i--) {
        const date = dateRange[i];
        const existing = tickerPrices.get(date);
        if (existing !== undefined) {
          nextKnownPrice = existing;
        } else if (nextKnownPrice !== null) {
          tickerPrices.set(date, nextKnownPrice);
        }
      }
    } else {
      let latestSeedPrice: number | null = null;
      let seedIdx = 0;

      for (const date of dateRange) {
        while (seedIdx < seeds.length && seeds[seedIdx].date <= date) {
          if (seeds[seedIdx].price > 0) {
            latestSeedPrice = seeds[seedIdx].price;
          }
          seedIdx++;
        }
        if (latestSeedPrice !== null) {
          tickerPrices.set(date, latestSeedPrice);
        }
      }
    }

    matrix.set(ticker, tickerPrices);
  }

  return matrix;
}
