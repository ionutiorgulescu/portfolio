import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';

export type TickerFundamentals = {
  ticker: string;
  name: string;
  currency: string;
  price: number | null;
  changePercent: number | null;
  marketState: string | null;
  preMarketPrice: number | null;
  postMarketPrice: number | null;
  extendedMarketPrice: number | null;
  preMarketChangePercent: number | null;
  postMarketChangePercent: number | null;
  extendedMarketChangePercent: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  open: number | null;
  previousClose: number | null;
  marketCap: number | null;
  epsTtm: number | null;
  floatShares: number | null;
  peRatioTtm: number | null;
  revenueTtm: number | null;
  ebitdaTtm: number | null;
  freeCashflowTtm: number | null;
};

type EdgeFunctionError = {
  error?: string;
  message?: string;
};

const FUNDAMENTALS_STALE_TIME_MS = 5 * 60 * 1000;

function parseError(payload: EdgeFunctionError | null, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload.error === 'string' && payload.error.length > 0) return payload.error;
  if (typeof payload.message === 'string' && payload.message.length > 0) return payload.message;
  return fallback;
}

export async function fetchTickerFundamentals(ticker: string): Promise<TickerFundamentals> {
  const { data, error } = await supabase.functions.invoke<
    TickerFundamentals | EdgeFunctionError
  >('fetch-ticker-fundamentals', {
    body: { ticker },
  });

  if (error) {
    let message = error.message || 'Failed to load fundamentals.';
    const context = error.context;
    if (context && typeof context.json === 'function') {
      try {
        const body = (await context.clone().json()) as EdgeFunctionError;
        message = parseError(body, message);
      } catch {
        // keep invoke error message
      }
    }
    throw new Error(message);
  }

  if (!data || typeof data !== 'object' || !('ticker' in data)) {
    throw new Error(parseError(data as EdgeFunctionError | null, 'Failed to load fundamentals.'));
  }

  return data as TickerFundamentals;
}

export function useTickerFundamentals(ticker: string) {
  const normalized = ticker.trim().toUpperCase();

  return useQuery({
    queryKey: ['ticker-fundamentals', normalized],
    queryFn: () => fetchTickerFundamentals(normalized),
    enabled: normalized.length > 0,
    staleTime: FUNDAMENTALS_STALE_TIME_MS,
  });
}
