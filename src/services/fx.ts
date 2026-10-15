import type { StockBarWithDate } from '../hooks/useStockData';
import { Currency } from '../types/positions';
import type { CostBasisParts } from '../types/performance';

/** Yahoo FX tickers quoting 1 unit of the currency in USD. */
export const FX_USD_TICKERS: Record<Exclude<Currency, 'USD'>, string> = {
  [Currency.RON]: 'RONUSD=X',
  [Currency.EUR]: 'EURUSD=X',
};

export type ForeignCurrency = keyof typeof FX_USD_TICKERS;

/** currency → daily (calendar-day) USD rate series. */
export type FxSeriesByCurrency = Map<ForeignCurrency, Map<string, number>>;
/** currency → single USD rate (spot / latest). */
export type FxRates = Map<ForeignCurrency, number>;

export function isForeignCurrency(currency: Currency | undefined): currency is ForeignCurrency {
  return currency !== undefined && currency !== Currency.USD;
}

/**
 * Currencies that must be converted to USD for a view.
 * The BVB view is shown natively in RON, so nothing is converted there.
 */
export function currenciesToConvert(
  currencies: Iterable<Currency | undefined>,
  nativeView: boolean,
): ForeignCurrency[] {
  if (nativeView) return [];
  const result = new Set<ForeignCurrency>();
  for (const currency of currencies) {
    if (isForeignCurrency(currency)) result.add(currency);
  }
  return [...result].sort();
}

/**
 * Like `currenciesToConvert`, but always includes EUR when the view is shown in EUR,
 * so the EUR→USD rate is fetched for converting USD totals back to EUR.
 */
export function currenciesToConvertForDisplay(
  currencies: Iterable<Currency | undefined>,
  nativeView: boolean,
  displayInEur: boolean,
): ForeignCurrency[] {
  const result = currenciesToConvert(currencies, nativeView);
  if (!displayInEur || result.includes(Currency.EUR)) return result;
  return [...result, Currency.EUR].sort();
}

/** USD → EUR multiplier from currency→USD rates; 0 when the EUR rate is missing. */
export function usdToEurRate(rates: FxRates): number {
  const eurUsd = rates.get(Currency.EUR) ?? 0;
  return eurUsd > 0 ? 1 / eurUsd : 0;
}

/** FX multiplier to USD for `currency`; 1 when it is not being converted. */
export function fxRateFor(
  currency: Currency | undefined,
  rates: FxRates,
  convert: readonly ForeignCurrency[],
): number {
  if (!isForeignCurrency(currency) || !convert.includes(currency)) return 1;
  return rates.get(currency) ?? 0;
}

/** Sums per-currency cost basis, converting the `convert` currencies with `rates`. */
export function sumCostBasis(
  parts: CostBasisParts | undefined,
  rates: FxRates,
  convert: readonly ForeignCurrency[],
): number {
  if (!parts) return 0;
  let total = 0;
  for (const [currency, amount] of Object.entries(parts) as [Currency, number][]) {
    total += amount * fxRateFor(currency, rates, convert);
  }
  return total;
}

/** Rates for one date from per-currency series (nearest-date fill, `fallback` spot). */
export function fxRatesOnDate(
  seriesByCurrency: FxSeriesByCurrency | null | undefined,
  date: string,
  fallback: FxRates,
  convert: readonly ForeignCurrency[],
): FxRates {
  const rates: FxRates = new Map();
  for (const currency of convert) {
    rates.set(
      currency,
      fxOnDate(seriesByCurrency?.get(currency), date, fallback.get(currency) ?? 0),
    );
  }
  return rates;
}

/**
 * Builds a calendar-day currency→USD rate series with forward/backward fill.
 * Optional `liveRate` overrides the latest date so today's mark matches spot.
 */
export function buildFxSeries(
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
export function fxOnDate(
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
