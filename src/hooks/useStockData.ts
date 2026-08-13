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

type FetchStockHistoryBatchResponse = {
  from: string;
  to: string;
  count: number;
  results: Array<{
    ticker: string;
    count: number;
    data: unknown[];
    error?: {
      code?: string;
      message?: string;
    };
  }>;
};

type EdgeFunctionError = {
  code?: string;
  error?: {
    code?: string;
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

type SlimStockBar = {
  t: number;
  c: number;
  d?: string;
};

/** Max tickers per edge-function call (must match server limit). */
const HISTORY_BATCH_SIZE = 25;
const MAX_HISTORY_ATTEMPTS = 3;
const HISTORY_STALE_TIME_MS = 30 * 60 * 1000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const formatDate = (timestamp: number): string => new Date(timestamp).toISOString().slice(0, 10);

/** Yahoo chart timestamps are unix seconds; daily bars are already ms. */
const toUnixMs = (t: number): number => (t > 0 && t < 1e12 ? t * 1000 : t);

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

const isSlimStockBar = (value: unknown): value is SlimStockBar => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const bar = value as Partial<SlimStockBar>;
  return typeof bar.t === 'number' && typeof bar.c === 'number';
};

const isTupleBar = (value: unknown): value is [string, number] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === 'string' &&
  typeof value[1] === 'number' &&
  Number.isFinite(value[1]);

const normalizeBars = (items: unknown[]): StockBarWithDate[] =>
  items.reduce<StockBarWithDate[]>((accumulator, item) => {
    if (isTupleBar(item)) {
      const [date, close] = item;
      const timestamp = Date.parse(`${date}T00:00:00.000Z`);
      accumulator.push({
        t: Number.isFinite(timestamp) ? timestamp : 0,
        o: close,
        h: close,
        l: close,
        c: close,
        v: 0,
        date,
      });
      return accumulator;
    }

    if (isStockBar(item)) {
      const t = toUnixMs(item.t);
      accumulator.push({
        ...item,
        t,
        date: formatDate(t),
      });
      return accumulator;
    }

    if (isMappedStockBar(item)) {
      const t = toUnixMs(item.timestamp);
      accumulator.push({
        t,
        o: item.open,
        h: item.high,
        l: item.low,
        c: item.close,
        v: item.volume,
        date: item.date || formatDate(t),
      });
      return accumulator;
    }

    if (isSlimStockBar(item)) {
      const t = toUnixMs(item.t);
      accumulator.push({
        t,
        o: item.c,
        h: item.c,
        l: item.c,
        c: item.c,
        v: 0,
        date: item.d || formatDate(t),
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

const isRetryableHistoryError = (message: string): boolean => {
  const lowered = message.toLowerCase();
  return (
    lowered.includes('boot_error') ||
    lowered.includes('failed to start') ||
    lowered.includes('503') ||
    lowered.includes('429') ||
    lowered.includes('rate limit') ||
    lowered.includes('worker') ||
    lowered.includes('failed to send a request to the edge function')
  );
};

const normalizeTickerList = (tickers: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of tickers) {
    const ticker = raw.trim().toUpperCase();
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    normalized.push(ticker);
  }

  return normalized;
};

const chunkTickers = (tickers: string[], size: number): string[][] => {
  const chunks: string[][] = [];
  for (let index = 0; index < tickers.length; index += size) {
    chunks.push(tickers.slice(index, index + size));
  }
  return chunks;
};

const readInvokeErrorMessage = async (invokeError: {
  message?: string;
  context?: Response;
}): Promise<string> => {
  const context = invokeError.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = (await context.clone().json()) as EdgeFunctionError;
      return parseResponseError(body);
    } catch {
      // ignore body parse failures
    }
  }
  return invokeError.message || 'Failed to invoke fetch-stock-history.';
};

const invokeStockHistoryBatch = async (
  tickers: string[],
): Promise<Map<string, StockBarWithDate[]>> => {
  const { data: responseData, error: invokeError } = await supabase.functions.invoke<
    FetchStockHistoryResponse | FetchStockHistoryBatchResponse | EdgeFunctionError
  >('fetch-stock-history', {
    body: tickers.length === 1 ? { ticker: tickers[0] } : { tickers },
  });

  if (invokeError) {
    throw new Error(await readInvokeErrorMessage(invokeError));
  }

  if (
    responseData &&
    typeof responseData === 'object' &&
    'code' in responseData &&
    (responseData as EdgeFunctionError).code === 'BOOT_ERROR'
  ) {
    throw new Error(parseResponseError(responseData as EdgeFunctionError));
  }

  const byTicker = new Map<string, StockBarWithDate[]>();

  // Legacy / single-ticker payload.
  if (
    responseData &&
    'data' in responseData &&
    Array.isArray(responseData.data) &&
    'ticker' in responseData &&
    typeof responseData.ticker === 'string'
  ) {
    byTicker.set(responseData.ticker, normalizeBars(responseData.data));
    return byTicker;
  }

  if (
    !responseData ||
    !('results' in responseData) ||
    !Array.isArray(responseData.results)
  ) {
    throw new Error(parseResponseError((responseData as EdgeFunctionError | null) ?? null));
  }

  for (const result of responseData.results) {
    byTicker.set(
      result.ticker,
      Array.isArray(result.data) ? normalizeBars(result.data) : [],
    );
  }

  return byTicker;
};

const invokeWithRetry = async (
  tickers: string[],
): Promise<Map<string, StockBarWithDate[]>> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_HISTORY_ATTEMPTS; attempt += 1) {
    try {
      return await invokeStockHistoryBatch(tickers);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const canRetry = attempt < MAX_HISTORY_ATTEMPTS && isRetryableHistoryError(message);
      if (!canRetry) break;
      await sleep(400 * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to load stock history.');
};

/**
 * Fetch daily history for many tickers in as few edge-function calls as possible.
 * Returns a map keyed by normalized ticker; missing/failed tickers map to [].
 */
export const fetchStockHistories = async (
  tickers: string[],
): Promise<Map<string, StockBarWithDate[]>> => {
  const normalized = normalizeTickerList(tickers);
  const byTicker = new Map<string, StockBarWithDate[]>();
  for (const ticker of normalized) byTicker.set(ticker, []);

  if (normalized.length === 0) return byTicker;

  try {
    for (const chunk of chunkTickers(normalized, HISTORY_BATCH_SIZE)) {
      const partial = await invokeWithRetry(chunk);
      for (const ticker of chunk) {
        byTicker.set(ticker, partial.get(ticker) ?? []);
      }
    }
    return byTicker;
  } catch (error) {
    console.error(error);
    return byTicker;
  }
};

export type IntradayInterval = '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '1h';

const INTRADAY_STALE_TIME_MS = 60 * 1000;

const invokeStockIntradayBatch = async (
  tickers: string[],
  interval: IntradayInterval,
): Promise<Map<string, StockBarWithDate[]>> => {
  const { data: responseData, error: invokeError } = await supabase.functions.invoke<
    FetchStockHistoryResponse | FetchStockHistoryBatchResponse | EdgeFunctionError
  >('fetch-stock-history', {
    body:
      tickers.length === 1
        ? { ticker: tickers[0], interval }
        : { tickers, interval },
  });

  if (invokeError) {
    throw new Error(await readInvokeErrorMessage(invokeError));
  }

  if (
    responseData &&
    typeof responseData === 'object' &&
    'code' in responseData &&
    (responseData as EdgeFunctionError).code === 'BOOT_ERROR'
  ) {
    throw new Error(parseResponseError(responseData as EdgeFunctionError));
  }

  const byTicker = new Map<string, StockBarWithDate[]>();

  if (
    responseData &&
    'data' in responseData &&
    Array.isArray(responseData.data) &&
    'ticker' in responseData &&
    typeof responseData.ticker === 'string'
  ) {
    byTicker.set(responseData.ticker, normalizeBars(responseData.data));
    return byTicker;
  }

  if (
    !responseData ||
    !('results' in responseData) ||
    !Array.isArray(responseData.results)
  ) {
    throw new Error(parseResponseError((responseData as EdgeFunctionError | null) ?? null));
  }

  for (const result of responseData.results) {
    byTicker.set(
      result.ticker,
      Array.isArray(result.data) ? normalizeBars(result.data) : [],
    );
  }

  return byTicker;
};

const invokeIntradayWithRetry = async (
  tickers: string[],
  interval: IntradayInterval,
): Promise<Map<string, StockBarWithDate[]>> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_HISTORY_ATTEMPTS; attempt += 1) {
    try {
      return await invokeStockIntradayBatch(tickers, interval);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const canRetry = attempt < MAX_HISTORY_ATTEMPTS && isRetryableHistoryError(message);
      if (!canRetry) break;
      await sleep(400 * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to load intraday stock history.');
};

/**
 * Fetch intraday bars (default 5m) for many tickers.
 * Bypasses the daily DB cache on the edge function.
 */
export const fetchStockIntradayHistories = async (
  tickers: string[],
  interval: IntradayInterval = '5m',
): Promise<Map<string, StockBarWithDate[]>> => {
  const normalized = normalizeTickerList(tickers);
  const byTicker = new Map<string, StockBarWithDate[]>();
  for (const ticker of normalized) byTicker.set(ticker, []);

  if (normalized.length === 0) return byTicker;

  try {
    for (const chunk of chunkTickers(normalized, HISTORY_BATCH_SIZE)) {
      const partial = await invokeIntradayWithRetry(chunk, interval);
      for (const ticker of chunk) {
        byTicker.set(ticker, partial.get(ticker) ?? []);
      }
    }
    return byTicker;
  } catch (error) {
    console.error(error);
    return byTicker;
  }
};

export const fetchStockHistory = async (ticker: string): Promise<StockBarWithDate[]> => {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return [];

  const byTicker = await fetchStockHistories([normalized]);
  return byTicker.get(normalized) ?? [];
};

export const fetchStockIntradayHistory = async (
  ticker: string,
  interval: IntradayInterval = '5m',
): Promise<StockBarWithDate[]> => {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return [];

  const byTicker = await fetchStockIntradayHistories([normalized], interval);
  return byTicker.get(normalized) ?? [];
};

export const useStockData = (ticker: string) => {
  const normalizedTicker = ticker.trim().toUpperCase();

  const { data, error, isLoading } = useQuery({
    queryKey: ['stock-history', normalizedTicker],
    queryFn: () => fetchStockHistory(normalizedTicker),
    enabled: normalizedTicker.length > 0,
    staleTime: HISTORY_STALE_TIME_MS,
  });

  return {
    data: data ?? [],
    error: error ? error.message : null,
    isLoading,
  };
};

export const useStockIntradayData = (
  ticker: string,
  interval: IntradayInterval = '5m',
  enabled = true,
) => {
  const normalizedTicker = ticker.trim().toUpperCase();

  const { data, error, isLoading } = useQuery({
    queryKey: ['stock-intraday', normalizedTicker, interval],
    queryFn: () => fetchStockIntradayHistory(normalizedTicker, interval),
    enabled: enabled && normalizedTicker.length > 0,
    staleTime: INTRADAY_STALE_TIME_MS,
  });

  return {
    data: data ?? [],
    error: error ? error.message : null,
    isLoading,
  };
};
