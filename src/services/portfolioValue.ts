import { Currency } from '../types/positions';
import type {
  DailyCostBasis,
  DailyHoldings,
  DailyTickerCost,
  PortfolioDataPoint,
  PriceMatrix,
} from '../types/performance';
import { ronUsdOnDate } from './ronUsd';

export type PortfolioValueOptions = {
  /** ticker → listing currency */
  tickerCurrency?: Map<string, Currency>;
  /**
   * Daily RON→USD FX (e.g. from RONUSD=X history).
   * Preferred over the scalar `ronToUsd` when converting BVB holdings.
   */
  ronToUsdByDate?: Map<string, number>;
  /** Fallback RON→USD FX when a date is missing from `ronToUsdByDate`. */
  ronToUsd?: number;
  /** When true, RON market value and cost basis are converted to USD. */
  convertRon?: boolean;
  /**
   * Per-day per-ticker remaining cost (native currency).
   * Used to value holdings at cost when a market quote is missing.
   */
  dailyTickerCost?: DailyTickerCost;
};

/**
 * Combines a daily holdings snapshot with a pre-built price matrix to
 * produce the total portfolio value and cost basis for every calendar day.
 *
 * For each day the value is: Σ (shares_held[ticker] × price[ticker][date] × fx)
 * When market price is missing, falls back to that ticker's remaining cost basis
 * so unpriced lots do not sit at $0 and later inflate TTWROR.
 *
 * The output array preserves the insertion order of `dailyHoldings`, which
 * is ascending date order as produced by the FIFO engine.
 */
export function computePortfolioValue(
  dailyHoldings: DailyHoldings,
  priceMatrix: PriceMatrix,
  dailyCostBasis: DailyCostBasis,
  options: PortfolioValueOptions = {},
): PortfolioDataPoint[] {
  const {
    tickerCurrency,
    ronToUsdByDate,
    ronToUsd = 0,
    convertRon = false,
    dailyTickerCost,
  } = options;
  const result: PortfolioDataPoint[] = [];

  for (const [date, holdings] of dailyHoldings) {
    let totalValue = 0;
    const costs = dailyTickerCost?.get(date);
    const dayFx = convertRon
      ? ronUsdOnDate(ronToUsdByDate, date, ronToUsd)
      : 1;

    for (const [ticker, shares] of holdings) {
      const currency = tickerCurrency?.get(ticker);
      const fx = convertRon && currency === Currency.RON ? dayFx : 1;
      const marketPrice = priceMatrix.get(ticker)?.get(date);

      if (marketPrice !== undefined && marketPrice > 0) {
        totalValue += shares * marketPrice * fx;
        continue;
      }

      // No usable market quote — value at remaining lot cost (same FX treatment).
      const cost = costs?.get(ticker);
      if (cost !== undefined && cost > 0) {
        totalValue += cost * fx;
      }
    }

    const parts = dailyCostBasis.get(date) ?? { usd: 0, ron: 0 };
    const costBasis = convertRon
      ? parts.usd + parts.ron * dayFx
      : parts.usd + parts.ron;

    result.push({ date, value: totalValue, costBasis });
  }

  return result;
}
