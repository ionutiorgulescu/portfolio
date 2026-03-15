import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';

export interface StockBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface StockBarWithDate extends StockBar {
  date: string;
}

type FetchStockHistoryResponse = {
  ticker: string;
  from: string;
  to: string;
  count: number;
  data: unknown[];
};

type EdgeFunctionError = {
  error?: {
    message?: string;
  };
  message?: string;
};

type MappedStockBar = {
  timestamp: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const formatDate = (timestamp: number): string => new Date(timestamp).toISOString().slice(0, 10);

const isStockBar = (value: unknown): value is StockBar => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const bar = value as Partial<StockBar>;
  return (
    typeof bar.t === 'number' &&
    typeof bar.o === 'number' &&
    typeof bar.h === 'number' &&
    typeof bar.l === 'number' &&
    typeof bar.c === 'number' &&
    typeof bar.v === 'number'
  );
};

const isMappedStockBar = (value: unknown): value is MappedStockBar => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const bar = value as Partial<MappedStockBar>;
  return (
    typeof bar.timestamp === 'number' &&
    typeof bar.open === 'number' &&
    typeof bar.high === 'number' &&
    typeof bar.low === 'number' &&
    typeof bar.close === 'number' &&
    typeof bar.volume === 'number'
  );
};

const normalizeBars = (items: unknown[]): StockBarWithDate[] =>
  items.reduce<StockBarWithDate[]>((accumulator, item) => {
    if (isStockBar(item)) {
      accumulator.push({
        ...item,
        date: formatDate(item.t),
      });
      return accumulator;
    }

    if (isMappedStockBar(item)) {
      accumulator.push({
        t: item.timestamp,
        o: item.open,
        h: item.high,
        l: item.low,
        c: item.close,
        v: item.volume,
        date: item.date || formatDate(item.timestamp),
      });
    }

    return accumulator;
  }, []);

const parseResponseError = (payload: EdgeFunctionError | null): string => {
  if (!payload) {
    return 'No response received from fetch-stock-history.';
  }

  if (payload.error?.message) {
    return payload.error.message;
  }

  if (payload.message) {
    return payload.message;
  }

  return 'Failed to load stock history.'; 
};

export const fetchStockHistory = async (ticker: string): Promise<StockBarWithDate[]> => {
  const { data: responseData, error: invokeError } = await supabase.functions.invoke<
    FetchStockHistoryResponse | EdgeFunctionError
  >('fetch-stock-history', {
    body: { ticker },
  });

  if (invokeError) {
    throw new Error(invokeError.message || 'Failed to invoke fetch-stock-history.');
  }

  if (!responseData || !('data' in responseData) || !Array.isArray(responseData.data)) {
    throw new Error(parseResponseError((responseData as EdgeFunctionError | null) ?? null));
  }

  return normalizeBars(responseData.data);
};

export const useStockData = (ticker: string) => {
  const normalizedTicker = ticker.trim().toUpperCase();

  const { data, error, isLoading } = useQuery({
    queryKey: ['stock-history', normalizedTicker],
    queryFn: () => fetchStockHistory(normalizedTicker),
    enabled: normalizedTicker.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: data ?? [],
    error: error ? error.message : null,
    isLoading,
  };
};
