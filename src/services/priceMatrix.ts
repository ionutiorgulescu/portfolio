import type { StockBarWithDate } from '../hooks/useStockData';
import type { PriceMatrix } from '../types/performance';

/**
 * Builds a `PriceMatrix` from a map of per-ticker historical bar arrays.
 *
 * For each ticker the function iterates every date in `dateRange` in order and
 * applies a last-known-price carry-forward: if a date has no market data
 * (weekend, public holiday, or pre-first-trade-date) the most recent closing
 * price is reused so that value computation never encounters a missing entry
 * for a ticker that has already started trading.
 *
 * Dates before the ticker's first available bar produce no entry (value
 * contribution for that ticker is treated as 0 by the value combinator).
 *
 * @param pricesByTicker  Map of ticker → bars returned by the Edge Function
 * @param dateRange       Ordered array of 'YYYY-MM-DD' strings (from FIFO engine)
 */
export function buildPriceMatrix(
  pricesByTicker: Map<string, StockBarWithDate[]>,
  dateRange: string[],
): PriceMatrix {
  const matrix: PriceMatrix = new Map();

  for (const [ticker, bars] of pricesByTicker) {
    // Index raw closing prices by date string for O(1) lookup
    const rawPrices = new Map<string, number>();
    for (const bar of bars) {
      rawPrices.set(bar.date, bar.c);
    }

    const tickerPrices = new Map<string, number>();
    let lastKnownPrice: number | null = null;

    for (const date of dateRange) {
      const price = rawPrices.get(date);

      if (price !== undefined) {
        lastKnownPrice = price;
        tickerPrices.set(date, price);
      } else if (lastKnownPrice !== null) {
        // Weekend or market holiday: carry forward the last closing price
        tickerPrices.set(date, lastKnownPrice);
      }
      // Before the first traded date: leave unset (no value contribution yet)
    }

    matrix.set(ticker, tickerPrices);
  }

  return matrix;
}
