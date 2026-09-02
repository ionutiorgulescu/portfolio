import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';

export type TickerSearchResult = {
  symbol: string;
  name: string;
  exchange: string;
  quoteType: string;
};

type SearchTickersResponse = {
  results?: TickerSearchResult[];
  error?: string;
};

type EdgeFunctionError = {
  error?: string;
  message?: string;
};

const SEARCH_STALE_TIME_MS = 5 * 60 * 1000;
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

function parseError(payload: EdgeFunctionError | null, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload.error === 'string' && payload.error.length > 0) return payload.error;
  if (typeof payload.message === 'string' && payload.message.length > 0) return payload.message;
  return fallback;
}

export async function searchTickers(query: string): Promise<TickerSearchResult[]> {
  const { data, error } = await supabase.functions.invoke<
    SearchTickersResponse | EdgeFunctionError
  >('search-tickers', {
    body: { query },
  });

  if (error) {
    let message = error.message || 'Failed to search tickers.';
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

  if (!data || typeof data !== 'object' || !('results' in data) || !Array.isArray(data.results)) {
    throw new Error(parseError(data as EdgeFunctionError | null, 'Failed to search tickers.'));
  }

  return data.results;
}

export function useTickerSearch(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  const normalized = debouncedQuery.trim();
  const enabled = normalized.length >= MIN_QUERY_LENGTH;

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['ticker-search', normalized],
    queryFn: () => searchTickers(normalized),
    enabled,
    staleTime: SEARCH_STALE_TIME_MS,
    retry: 1,
  });

  return {
    results: enabled ? (data ?? []) : [],
    isFetching: enabled && isFetching,
    isError,
    error: error instanceof Error ? error : null,
  };
}
