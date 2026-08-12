export type PriceSession = 'PRE' | 'POST';

export type QuoteResult = {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number | null;
  regularMarketChangePercent?: number | null;
  marketState?: string;
  preMarketPrice?: number | null;
  postMarketPrice?: number | null;
  preMarketChangePercent?: number | null;
  postMarketChangePercent?: number | null;
  /** Unified Yahoo/FMP extended-hours price (PRE or POST). */
  extendedMarketPrice?: number | null;
  extendedMarketChangePercent?: number | null;
};

function toNum(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function percentChange(from: number, to: number): number | null {
  if (from <= 0) return null;
  return ((to - from) / from) * 100;
}

/**
 * Resolve PRE/POST/REGULAR display price (+ optional session badge %).
 * Yahoo often sets marketState=PRE before preMarketPrice exists — in that case
 * fall back to regularMarketPrice / overnight move vs previous close.
 */
export function resolveQuotePrice(quote?: QuoteResult): {
  price: number;
  session: PriceSession | null;
  sessionChangePercent: number | null;
  /** True when Yahoo reports regular trading hours (REGULAR). */
  isMarketOpen: boolean;
  /** Intraday % vs previous close during regular hours; null otherwise. */
  dayChangePercent: number | null;
} {
  const regular = toNum(quote?.regularMarketPrice) ?? 0;
  const previousClose = toNum(quote?.regularMarketPreviousClose);
  const regularChangePercent = toNum(quote?.regularMarketChangePercent);
  const marketState = String(quote?.marketState ?? '').toUpperCase();
  // PREPRE/POSTPOST are outside live extended hours — no session badge.
  const isPre = marketState === 'PRE';
  const isPost = marketState === 'POST';
  const isMarketOpen = marketState === 'REGULAR';

  if (isPre) {
    const sessionPrice =
      toNum(quote?.preMarketPrice) ?? toNum(quote?.extendedMarketPrice);
    const apiPct =
      toNum(quote?.preMarketChangePercent) ?? toNum(quote?.extendedMarketChangePercent);
    const price = sessionPrice ?? regular;
    const baseline = regular > 0 ? regular : (previousClose ?? 0);

    const sessionChangePercent =
      apiPct
      ?? (sessionPrice != null ? percentChange(baseline, sessionPrice) : null)
      ?? regularChangePercent
      ?? (previousClose != null ? percentChange(previousClose, price) : null);

    return {
      price,
      session: 'PRE',
      sessionChangePercent,
      isMarketOpen: false,
      dayChangePercent: null,
    };
  }

  if (isPost) {
    const sessionPrice =
      toNum(quote?.postMarketPrice) ?? toNum(quote?.extendedMarketPrice);
    const apiPct =
      toNum(quote?.postMarketChangePercent) ?? toNum(quote?.extendedMarketChangePercent);
    const price = sessionPrice ?? regular;
    const baseline = regular > 0 ? regular : (previousClose ?? 0);

    const sessionChangePercent =
      apiPct
      ?? (sessionPrice != null ? percentChange(baseline, sessionPrice) : null)
      ?? regularChangePercent
      ?? (previousClose != null ? percentChange(previousClose, price) : null);

    return {
      price,
      session: 'POST',
      sessionChangePercent,
      isMarketOpen: false,
      dayChangePercent: null,
    };
  }

  return {
    price: regular,
    session: null,
    sessionChangePercent: null,
    isMarketOpen,
    dayChangePercent: isMarketOpen ? regularChangePercent : null,
  };
}
