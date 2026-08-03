import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';

export type StockLogoResult = {
  ticker: string;
  logo: string | null;
};

const LOGO_STALE_TIME_MS = 24 * 60 * 60 * 1000;
const LOGO_GC_TIME_MS = 7 * 24 * 60 * 60 * 1000;

async function fetchStockLogos(tickers: string[]): Promise<StockLogoResult[]> {
  const { data, error } = await supabase.functions.invoke<StockLogoResult[] | { error: string }>(
    'get-stock-logos',
    { body: { tickers } },
  );

  if (error) {
    throw new Error(error.message || 'Failed to fetch stock logos.');
  }

  if (!Array.isArray(data)) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Failed to fetch stock logos.';
    throw new Error(message);
  }

  return data;
}

/**
 * Fetches Finnhub company logos for the given tickers.
 * Cached for 24h (logos rarely change); shared via React Query across the app.
 */
export function useStockLogos(tickers: string[]) {
  const normalized = [
    ...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean)),
  ].sort();

  const { data, isLoading, error } = useQuery({
    queryKey: ['stock-logos', normalized],
    queryFn: () => fetchStockLogos(normalized),
    enabled: normalized.length > 0,
    staleTime: LOGO_STALE_TIME_MS,
    gcTime: LOGO_GC_TIME_MS,
  });

  const logosByTicker = new Map<string, string | null>(
    (data ?? []).map((item) => [item.ticker, item.logo]),
  );

  return {
    logosByTicker,
    loading: isLoading,
    error: error as Error | null,
  };
}
