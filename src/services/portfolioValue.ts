import type { DailyCostBasis, DailyHoldings, PortfolioDataPoint, PriceMatrix } from '../types/performance';

/**
 * Combines a daily holdings snapshot with a pre-built price matrix to
 * produce the total portfolio value and cost basis for every calendar day.
 *
 * For each day the value is: Σ (shares_held[ticker] × price[ticker][date])
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
): PortfolioDataPoint[] {
  const result: PortfolioDataPoint[] = [];

  for (const [date, holdings] of dailyHoldings) {
    let totalValue = 0;

    for (const [ticker, shares] of holdings) {
      const price = priceMatrix.get(ticker)?.get(date);
      if (price !== undefined) {
        totalValue += shares * price;
      }
    }

    result.push({ date, value: totalValue, costBasis: dailyCostBasis.get(date) ?? 0 });
  }

  return result;
}
