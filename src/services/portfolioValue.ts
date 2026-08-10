import { Currency } from '../types/positions';
import type { DailyCostBasis, DailyHoldings, PortfolioDataPoint, PriceMatrix } from '../types/performance';

export type PortfolioValueOptions = {
  /** ticker → listing currency */
  tickerCurrency?: Map<string, Currency>;
  /** RON→USD FX rate (e.g. from RONUSD=X). Used when convertRon is true. */
  ronToUsd?: number;
  /** When true, RON market value and cost basis are converted to USD. */
  convertRon?: boolean;
};

/**
 * Combines a daily holdings snapshot with a pre-built price matrix to
 * produce the total portfolio value and cost basis for every calendar day.
 *
 * For each day the value is: Σ (shares_held[ticker] × price[ticker][date] × fx)
 * Tickers with no price entry on a given date (pre-IPO / missing data) are
 * skipped — their value contribution is treated as 0.
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
  const { tickerCurrency, ronToUsd = 0, convertRon = false } = options;
  const result: PortfolioDataPoint[] = [];

  for (const [date, holdings] of dailyHoldings) {
    let totalValue = 0;

    for (const [ticker, shares] of holdings) {
      const price = priceMatrix.get(ticker)?.get(date);
      if (price === undefined) continue;

      const currency = tickerCurrency?.get(ticker);
      const fx = convertRon && currency === Currency.RON ? ronToUsd : 1;
      totalValue += shares * price * fx;
    }

    const parts = dailyCostBasis.get(date) ?? { usd: 0, ron: 0 };
    const costBasis = convertRon
      ? parts.usd + parts.ron * ronToUsd
      : parts.usd + parts.ron;

    result.push({ date, value: totalValue, costBasis });
  }

  return result;
}
