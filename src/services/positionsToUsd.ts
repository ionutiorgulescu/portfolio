import { fetchStockHistories } from '../hooks/useStockData';
import { Currency, type Position } from '../types/positions';
import { FX_USD_TICKERS, fxOnDate, isForeignCurrency, type ForeignCurrency } from './fx';

/**
 * Restates non-USD positions in USD at the FX rate of each trade date
 * (nearest available day when the trade date has no bar).
 * Throws when a needed rate is unavailable so totals are never silently understated.
 */
export async function convertPositionsToUsd(positions: Position[]): Promise<Position[]> {
  const foreign = [
    ...new Set(
      positions
        .map((pos) => pos.currency)
        .filter((currency): currency is ForeignCurrency => isForeignCurrency(currency)),
    ),
  ];
  if (foreign.length === 0) return positions;

  const histories = await fetchStockHistories(foreign.map((currency) => FX_USD_TICKERS[currency]));
  const seriesByCurrency = new Map<ForeignCurrency, Map<string, number>>();
  for (const currency of foreign) {
    const series = new Map<string, number>();
    for (const bar of histories.get(FX_USD_TICKERS[currency]) ?? []) {
      if (Number.isFinite(bar.c) && bar.c > 0) series.set(bar.date, bar.c);
    }
    if (series.size === 0) {
      throw new Error(`Missing ${currency}→USD exchange rate history`);
    }
    seriesByCurrency.set(currency, series);
  }

  return positions.map((pos) => {
    if (!isForeignCurrency(pos.currency)) return pos;
    const rate = fxOnDate(seriesByCurrency.get(pos.currency), pos.buy_date);
    return { ...pos, price: Number(pos.price) * rate, currency: Currency.USD };
  });
}
