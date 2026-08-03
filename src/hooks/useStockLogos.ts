import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';

export type StockLogoResult = {
  ticker: string;
  logo: string | null;
};

/** Local public assets for crypto pairs Finnhub does not cover. */
const LOCAL_CRYPTO_LOGOS: Record<string, string> = {
  'BTC-USD': '/BTC.png',
  'ETH-USD': '/ETH.png',
};

const LOGO_STALE_TIME_MS = 24 * 60 * 60 * 1000;
const LOGO_GC_TIME_MS = 7 * 24 * 60 * 60 * 1000;

async function fetchStockLogos(tickers: string[]): Promise<StockLogoResult[]> {
  if (tickers.length === 0) return [];

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
 * Resolves logos for tickers: local assets for known crypto pairs,
 * Finnhub (Postgres-cached) for everything else.
 */
export function useStockLogos(tickers: string[]) {
  const normalized = [
    ...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean)),
  ].sort();

  const remoteTickers = normalized.filter((ticker) => !(ticker in LOCAL_CRYPTO_LOGOS));

  const { data, isLoading, error } = useQuery({
    queryKey: ['stock-logos', remoteTickers],
    queryFn: () => fetchStockLogos(remoteTickers),
    enabled: remoteTickers.length > 0,
    staleTime: LOGO_STALE_TIME_MS,
    gcTime: LOGO_GC_TIME_MS,
  });

  const logosByTicker = new Map<string, string | null>();

  for (const ticker of normalized) {
    const localLogo = LOCAL_CRYPTO_LOGOS[ticker];
    if (localLogo) {
      logosByTicker.set(ticker, localLogo);
      continue;
    }
    const remote = data?.find((item) => item.ticker === ticker);
    logosByTicker.set(ticker, remote?.logo ?? null);
  }

  return {
    logosByTicker,
    loading: remoteTickers.length > 0 && isLoading,
    error: error as Error | null,
  };
}
