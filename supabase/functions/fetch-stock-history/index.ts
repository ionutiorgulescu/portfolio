// @ts-ignore: Resolved by Deno's npm specifier support in Supabase Edge runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore: Resolved by Deno's npm specifier support in Supabase Edge runtime.
import YahooFinance from "npm:yahoo-finance2";
// @ts-ignore: Resolved by Deno's npm specifier support in Supabase Edge runtime.
import { createClient } from "jsr:@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;
const yahooFinance = new YahooFinance({
  suppressNotices: ['ripHistorical'], validation: {
    logErrors: false, // stops it from console.error-ing on schema failures
  },
});

// Local fallback type for editors/linters that are not configured with Deno libs.
declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

type YahooHistoricalRow = {
  date?: Date | string | null;
  open?: number | string | null;
  high?: number | string | null;
  low?: number | string | null;
  close?: number | string | null;
  adjClose?: number | string | null;
  volume?: number | string | null;
};

type StockBar = {
  timestamp: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/** Slim wire format: [date, close]. */
type ResponseBar = [string, number];

/** Intraday wire format: unix ms + close. */
type IntradayBar = { t: number; c: number };

type YahooChartInterval =
  | "1m"
  | "2m"
  | "5m"
  | "15m"
  | "30m"
  | "60m"
  | "90m"
  | "1h"
  | "1d"
  | "5d"
  | "1wk"
  | "1mo"
  | "3mo";

const INTRADAY_INTERVALS = new Set<YahooChartInterval>([
  "1m",
  "2m",
  "5m",
  "15m",
  "30m",
  "60m",
  "90m",
  "1h",
]);

/** How far back to request for intraday (Yahoo ~60d for 5m; keep small). */
const INTRADAY_LOOKBACK_MS = 5 * 24 * 60 * 60 * 1000;

type SeriesRow = {
  ticker: string;
  latest_date: string | null;
  bars: unknown;
};

type TickerResult = {
  ticker: string;
  count: number;
  data: ResponseBar[] | IntradayBar[];
  error?: {
    code: string;
    message: string;
  };
};

type EdgeRuntimeGlobal = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

type ErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DB_PAGE_SIZE = 1000;
const UPSERT_CHUNK_SIZE = 500;
const MAX_TICKERS_PER_REQUEST = 25;
const YAHOO_CONCURRENCY = 3;
/** Skip Yahoo when latest bar is within this many calendar days (covers weekends). Live tip comes from quotes. */
const CACHE_MAX_STALE_DAYS = 3;

const scheduleBackground = (promise: Promise<unknown>): void => {
  const edgeRuntime = (globalThis as { EdgeRuntime?: EdgeRuntimeGlobal }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(promise);
    return;
  }
  promise.catch((error) => console.error("background task failed:", error));
};

const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });

const errorResponse = (
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response => {
  const payload: ErrorPayload = {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };

  return jsonResponse(status, payload);
};

const formatDate = (value: Date): string => value.toISOString().slice(0, 10);

const getDateRange = (): { from: string; to: string } => {
  const toDate = new Date();
  toDate.setUTCDate(toDate.getUTCDate() + 1);
  const fromDate = new Date(toDate);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 9);

  return {
    from: formatDate(fromDate),
    to: formatDate(toDate),
  };
};

const normalizeTicker = (value: string): string | null => {
  const ticker = value.trim().toUpperCase();
  const tickerPattern = /^[A-Z0-9.=-]{1,15}$/;
  return tickerPattern.test(ticker) ? ticker : null;
};

const parseRequestBody = async (request: Request): Promise<JsonRecord | null> => {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as JsonRecord)
      : null;
  } catch {
    return null;
  }
};

const collectRawTickers = (body: JsonRecord | null, url: URL): string[] => {
  const raw: string[] = [];

  if (body) {
    if (typeof body.ticker === "string") raw.push(body.ticker);
    if (Array.isArray(body.tickers)) {
      for (const value of body.tickers) {
        if (typeof value === "string") raw.push(value);
      }
    }
  }

  const queryTicker = url.searchParams.get("ticker");
  if (queryTicker) raw.push(queryTicker);

  const queryTickers = url.searchParams.get("tickers");
  if (queryTickers) {
    for (const part of queryTickers.split(",")) {
      if (part.trim()) raw.push(part);
    }
  }

  return raw;
};

const getTickersFromBody = (body: JsonRecord | null, url: URL): string[] => {
  const seen = new Set<string>();
  const tickers: string[] = [];

  for (const raw of collectRawTickers(body, url)) {
    const ticker = normalizeTicker(raw);
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    tickers.push(ticker);
  }

  return tickers;
};

const parseYahooInterval = (
  body: JsonRecord | null,
  url: URL,
): YahooChartInterval => {
  const raw =
    (body && typeof body.interval === "string" ? body.interval : null) ??
    url.searchParams.get("interval") ??
    "1d";
  const normalized = raw.trim().toLowerCase() as YahooChartInterval;
  const allowed: YahooChartInterval[] = [
    "1m",
    "2m",
    "5m",
    "15m",
    "30m",
    "60m",
    "90m",
    "1h",
    "1d",
    "5d",
    "1wk",
    "1mo",
    "3mo",
  ];
  return allowed.includes(normalized) ? normalized : "1d";
};

const isYahooHistoricalRow = (value: unknown): value is YahooHistoricalRow => {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<YahooHistoricalRow>;
  if (row.date instanceof Date) return true;
  return typeof row.date === "string";
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseYahooDateToTimestamp = (value: Date | string): number => {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  if (Number.isFinite(parsed)) return parsed;
  return value instanceof Date ? NaN : Date.parse(`${value}T00:00:00.000Z`);
};

const mapYahooRow = (row: YahooHistoricalRow): StockBar | null => {
  if (!row.date) return null;

  const timestamp = parseYahooDateToTimestamp(row.date);
  const close = toFiniteNumber(row.close) ?? toFiniteNumber(row.adjClose);
  const open = toFiniteNumber(row.open) ?? close;
  const high = toFiniteNumber(row.high) ?? close;
  const low = toFiniteNumber(row.low) ?? close;
  const volume = toFiniteNumber(row.volume) ?? 0;

  if (
    !Number.isFinite(timestamp) ||
    open === null ||
    high === null ||
    low === null ||
    close === null
  ) {
    return null;
  }

  return {
    timestamp,
    date: formatDate(new Date(timestamp)),
    open,
    high,
    low,
    close,
    volume,
  };
};

const mapYahooError = (error: unknown): ErrorPayload["error"] => {
  const message = error instanceof Error ? error.message : "Unknown Yahoo Finance error.";
  const lowered = message.toLowerCase();

  if (lowered.includes("rate limit") || lowered.includes("too many requests")) {
    return {
      code: "rate_limited",
      message: "Yahoo Finance rate limit reached. Please retry later.",
      details: error,
    };
  }

  if (
    lowered.includes("no data found") ||
    lowered.includes("symbol may be delisted") ||
    lowered.includes("not found")
  ) {
    return {
      code: "ticker_not_found",
      message: "Ticker not found in Yahoo Finance.",
      details: error,
    };
  }

  if (lowered.includes("invalid") || lowered.includes("bad request")) {
    return {
      code: "bad_request",
      message,
      details: error,
    };
  }

  return {
    code: "upstream_error",
    message,
    details: error,
  };
};

const fetchAllBars = async (
  ticker: string,
  from: string,
  to: string,
): Promise<StockBar[]> => {
  try {
    const result = await yahooFinance.chart(ticker, {
      period1: new Date(from),
      period2: new Date(to),
      interval: "1d",
    });

    const normalizedRows: unknown[] = Array.isArray(result?.quotes)
      ? result.quotes
      : [];
    const bars = normalizedRows
      .filter(isYahooHistoricalRow)
      .map(mapYahooRow)
      .filter((bar): bar is StockBar => bar !== null)
      .filter((bar) => bar.close > 0)
      .sort((left, right) => left.timestamp - right.timestamp);
    // Yahoo's daily `quotes` candle for the most recent session sometimes
    // arrives with a null close before it's fully finalized. Fall back to
    // the live quote snapshot in `meta` when it's more recent than our
    // last valid bar, so the chart doesn't lag behind the live price.
    const lastBar = bars[bars.length - 1];
    const metaPrice = result?.meta?.regularMarketPrice;
    const metaTimeRaw = result?.meta?.regularMarketTime;
    const metaTimestamp = metaTimeRaw ? new Date(metaTimeRaw).getTime() : NaN;

    if (
      Number.isFinite(metaTimestamp) &&
      typeof metaPrice === "number" &&
      Number.isFinite(metaPrice) &&
      metaPrice > 0 &&
      (!lastBar || formatDate(new Date(metaTimestamp)) !== lastBar.date)
    ) {
      bars.push({
        timestamp: metaTimestamp,
        date: formatDate(new Date(metaTimestamp)),
        open: metaPrice,
        high: metaPrice,
        low: metaPrice,
        close: metaPrice,
        volume: 0,
      });
    }

    return bars;
  } catch (upstreamError) {
    const mapped = mapYahooError(upstreamError);
    const error = new Error(mapped.message) as Error & {
      status?: number;
      code?: string;
      details?: unknown;
    };
    error.status = mapped.code === "rate_limited"
      ? 429
      : mapped.code === "ticker_not_found"
        ? 404
        : mapped.code === "bad_request"
          ? 400
          : 502;
    error.code = mapped.code;
    error.details = mapped.details;
    console.log(error);
    throw error;
  }
};

const createServiceClient = (): SupabaseClient | null => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
};

const toResponseBar = (bar: StockBar): ResponseBar => [bar.date, bar.close];

const parseSeriesBars = (bars: unknown, from: string, to: string): ResponseBar[] => {
  if (!Array.isArray(bars)) return [];

  const parsed: ResponseBar[] = [];
  for (const item of bars) {
    if (
      !Array.isArray(item) ||
      item.length < 2 ||
      typeof item[0] !== "string" ||
      typeof item[1] !== "number" ||
      !Number.isFinite(item[1])
    ) {
      continue;
    }
    const date = item[0];
    if (date < from || date >= to) continue;
    parsed.push([date, item[1]]);
  }
  return parsed;
};

const responseBarsToStockBars = (bars: ResponseBar[]): StockBar[] =>
  bars.map(([date, close]) => {
    const timestamp = Date.parse(`${date}T00:00:00.000Z`);
    return {
      timestamp: Number.isFinite(timestamp) ? timestamp : 0,
      date,
      open: close,
      high: close,
      low: close,
      close,
      volume: 0,
    };
  });

const barToCachedRow = (ticker: string, bar: StockBar) => ({
  ticker,
  trade_date: bar.date,
  timestamp: bar.timestamp,
  open: bar.open,
  high: bar.high,
  low: bar.low,
  close: bar.close,
  volume: bar.volume,
});

const loadViaRpc = async (
  supabase: SupabaseClient,
  tickers: string[],
  from: string,
  to: string,
): Promise<Map<string, ResponseBar[]> | null> => {
  const byTicker = new Map<string, ResponseBar[]>();
  for (const ticker of tickers) byTicker.set(ticker, []);
  if (tickers.length === 0) return byTicker;

  const { data, error } = await supabase.rpc("get_stock_price_history_batch", {
    p_tickers: tickers,
    p_from: from,
    p_to: to,
  });

  if (error) {
    console.error("get_stock_price_history_batch failed:", error.message);
    return null;
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  for (const ticker of tickers) {
    byTicker.set(ticker, parseSeriesBars(payload[ticker], from, to));
  }

  return byTicker;
};

const loadCachedBarsForTickers = async (
  supabase: SupabaseClient,
  tickers: string[],
  from: string,
  to: string,
): Promise<Map<string, ResponseBar[]> | null> => {
  const byTicker = new Map<string, ResponseBar[]>();
  for (const ticker of tickers) byTicker.set(ticker, []);
  if (tickers.length === 0) return byTicker;

  // Fast path: one row per ticker from denormalized series table.
  const { data: seriesRows, error: seriesError } = await supabase
    .from("stock_price_series")
    .select("ticker, latest_date, bars")
    .in("ticker", tickers);

  if (!seriesError && Array.isArray(seriesRows)) {
    const found = new Set<string>();
    for (const row of seriesRows as SeriesRow[]) {
      byTicker.set(row.ticker, parseSeriesBars(row.bars, from, to));
      found.add(row.ticker);
    }

    const missing = tickers.filter((ticker) => !found.has(ticker));
    if (missing.length === 0) return byTicker;

    const fromRpc = await loadViaRpc(supabase, missing, from, to);
    if (!fromRpc) return byTicker;

    for (const ticker of missing) {
      const bars = fromRpc.get(ticker) ?? [];
      byTicker.set(ticker, bars);
      if (bars.length > 0) {
        scheduleBackground(
          supabase.rpc("rebuild_stock_price_series", { p_ticker: ticker }).then(
            ({ error }: { error: { message?: string } | null }) => {
              if (error) {
                console.error(`rebuild_stock_price_series failed for ${ticker}:`, error.message);
              }
            },
          ),
        );
      }
    }

    return byTicker;
  }

  if (seriesError) {
    console.error("stock_price_series read failed:", seriesError.message);
  }

  // Fallback: aggregate in one RPC (still one round-trip, no pagination).
  const fromRpc = await loadViaRpc(supabase, tickers, from, to);
  if (fromRpc) return fromRpc;

  // Last resort: paginated table scan (legacy / if RPC missing).
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("stock_price_history")
      .select("ticker, trade_date, close")
      .in("ticker", tickers)
      .gte("trade_date", from)
      .lt("trade_date", to)
      .order("ticker", { ascending: true })
      .order("trade_date", { ascending: true })
      .range(offset, offset + DB_PAGE_SIZE - 1);

    if (error) {
      console.error("stock_price_history read failed:", error.message);
      return null;
    }

    const page = (data ?? []) as Array<{ ticker: string; trade_date: string; close: number }>;
    for (const row of page) {
      const bars = byTicker.get(row.ticker);
      if (bars) bars.push([row.trade_date, row.close]);
    }

    if (page.length < DB_PAGE_SIZE) break;
    offset += DB_PAGE_SIZE;
  }

  return byTicker;
};

const rebuildSeries = async (supabase: SupabaseClient, ticker: string): Promise<void> => {
  const { error } = await supabase.rpc("rebuild_stock_price_series", { p_ticker: ticker });
  if (error) {
    console.error(`rebuild_stock_price_series failed for ${ticker}:`, error.message);
  }
};

const upsertCachedBars = async (
  supabase: SupabaseClient,
  ticker: string,
  bars: StockBar[],
): Promise<void> => {
  if (bars.length === 0) return;

  const updatedAt = new Date().toISOString();
  const payload = bars.map((bar) => ({
    ...barToCachedRow(ticker, bar),
    updated_at: updatedAt,
  }));

  for (let index = 0; index < payload.length; index += UPSERT_CHUNK_SIZE) {
    const chunk = payload.slice(index, index + UPSERT_CHUNK_SIZE);
    const { error } = await supabase
      .from("stock_price_history")
      .upsert(chunk, { onConflict: "ticker,trade_date" });

    if (error) {
      console.error("stock_price_history upsert failed:", error.message);
      return;
    }
  }

  await rebuildSeries(supabase, ticker);
};

const mergeBarsByDate = (existing: StockBar[], incoming: StockBar[]): StockBar[] => {
  const byDate = new Map<string, StockBar>();
  for (const bar of existing) byDate.set(bar.date, bar);
  for (const bar of incoming) byDate.set(bar.date, bar);
  return [...byDate.values()].sort((left, right) => left.timestamp - right.timestamp);
};

const isCacheFresh = (latestCachedDate: string): boolean => {
  const today = formatDate(new Date());
  if (latestCachedDate >= today) return true;

  const latest = new Date(`${latestCachedDate}T00:00:00.000Z`).getTime();
  const now = new Date(`${today}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(latest) || !Number.isFinite(now)) return false;

  const staleDays = (now - latest) / (24 * 60 * 60 * 1000);
  return staleDays <= CACHE_MAX_STALE_DAYS;
};

/**
 * Decide the Yahoo window to fetch.
 * - No cache → full requested range.
 * - Cache is fresh enough (today, or within weekend/holiday slack) → skip Yahoo.
 * - Otherwise refetch from the last cached day through `to`.
 */
const resolveYahooFetchRange = (
  cachedBars: StockBar[],
  from: string,
  to: string,
): { from: string; to: string } | null => {
  if (cachedBars.length === 0) {
    return { from, to };
  }

  const latestCachedDate = cachedBars[cachedBars.length - 1]?.date;
  if (!latestCachedDate) {
    return { from, to };
  }

  if (isCacheFresh(latestCachedDate)) {
    return null;
  }

  // Inclusive refetch of the latest day so an incomplete meta candle can be replaced.
  const fetchFrom = latestCachedDate < from ? from : latestCachedDate;
  if (fetchFrom >= to) return null;

  return { from: fetchFrom, to };
};

const getBarsWithCache = async (
  ticker: string,
  from: string,
  to: string,
  serviceClient: SupabaseClient | null,
  cachedBars: StockBar[],
): Promise<StockBar[]> => {
  const yahooRange = resolveYahooFetchRange(cachedBars, from, to);
  if (!yahooRange) {
    return cachedBars;
  }

  try {
    const fetchedBars = await fetchAllBars(ticker, yahooRange.from, yahooRange.to);

    if (serviceClient && fetchedBars.length > 0) {
      await upsertCachedBars(serviceClient, ticker, fetchedBars);
    }

    return mergeBarsByDate(cachedBars, fetchedBars);
  } catch (error) {
    // Prefer serving stale cache over failing the request when we already have history.
    if (cachedBars.length > 0) {
      console.error("Yahoo refresh failed; returning cached bars:", error);
      return cachedBars;
    }
    throw error;
  }
};

const mapPool = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index]);
      }
    },
  );

  await Promise.all(workers);
  return results;
};

const toTickerError = (error: unknown): NonNullable<TickerResult["error"]> => {
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    error instanceof Error
  ) {
    return {
      code: (error as { code: string }).code,
      message: error.message,
    };
  }

  return {
    code: "fetch_failed",
    message: error instanceof Error
      ? error.message
      : "Failed to fetch stock history from Yahoo Finance.",
  };
};

const yahooUnixToMs = (value: number): number =>
  value > 0 && value < 1e12 ? value * 1000 : value;

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      meta?: {
        regularMarketPrice?: number;
        regularMarketTime?: number | string;
      };
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
      };
    }>;
    error?: { description?: string };
  };
};

const barsFromYahooChart = (
  timestamps: number[],
  closes: Array<number | null | undefined>,
  metaPrice?: number,
  metaTimeRaw?: number | string | Date,
): IntradayBar[] => {
  const bars: IntradayBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = yahooUnixToMs(timestamps[i]);
    const c = closes[i];
    if (Number.isFinite(t) && typeof c === "number" && Number.isFinite(c) && c > 0) {
      bars.push({ t, c });
    }
  }
  bars.sort((left, right) => left.t - right.t);

  const metaTimestamp = typeof metaTimeRaw === "number"
    ? yahooUnixToMs(metaTimeRaw)
    : metaTimeRaw
      ? new Date(metaTimeRaw).getTime()
      : NaN;
  const lastBar = bars[bars.length - 1];
  if (
    Number.isFinite(metaTimestamp) &&
    typeof metaPrice === "number" &&
    Number.isFinite(metaPrice) &&
    metaPrice > 0 &&
    (!lastBar || metaTimestamp > lastBar.t)
  ) {
    bars.push({ t: metaTimestamp, c: metaPrice });
  }
  return bars;
};

const fetchYahooChartRaw = async (
  ticker: string,
  interval: YahooChartInterval,
  period1: Date,
  period2: Date,
): Promise<IntradayBar[]> => {
  const p1 = Math.floor(period1.getTime() / 1000);
  const p2 = Math.floor(period2.getTime() / 1000);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?interval=${encodeURIComponent(interval)}` +
    `&period1=${p1}&period2=${p2}&includePrePost=true`;

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!response.ok) {
    throw new Error(`Yahoo chart HTTP ${response.status}`);
  }

  const payload = (await response.json()) as YahooChartPayload;
  const result = payload.chart?.result?.[0];
  if (!result) {
    throw new Error(payload.chart?.error?.description ?? "Empty Yahoo chart result");
  }

  return barsFromYahooChart(
    result.timestamp ?? [],
    result.indicators?.quote?.[0]?.close ?? [],
    result.meta?.regularMarketPrice,
    result.meta?.regularMarketTime,
  );
};

const fetchIntradayBars = async (
  ticker: string,
  interval: YahooChartInterval,
  period1: Date,
  period2: Date,
): Promise<IntradayBar[]> => {
  try {
    try {
      const rawBars = await fetchYahooChartRaw(ticker, interval, period1, period2);
      if (rawBars.length > 0) return rawBars;
    } catch {
      // Fall through to yahoo-finance2.
    }

    const result = await yahooFinance.chart(
      ticker,
      {
        period1,
        period2,
        interval,
        includePrePost: true,
        return: "object",
      },
      { validateResult: false },
    );

    const timestamps = Array.isArray(result?.timestamp) ? result.timestamp as number[] : [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const bars = barsFromYahooChart(
      timestamps,
      closes,
      result?.meta?.regularMarketPrice,
      result?.meta?.regularMarketTime,
    );
    if (bars.length > 0) return bars;

    const quoteRows: unknown[] = Array.isArray(result?.quotes) ? result.quotes : [];
    return quoteRows
      .filter(isYahooHistoricalRow)
      .map(mapYahooRow)
      .filter((bar): bar is StockBar => bar !== null)
      .filter((bar) => bar.close > 0)
      .sort((left, right) => left.timestamp - right.timestamp)
      .map((bar): IntradayBar => ({ t: bar.timestamp, c: bar.close }));
  } catch (upstreamError) {
    const mapped = mapYahooError(upstreamError);
    const error = new Error(mapped.message) as Error & {
      status?: number;
      code?: string;
      details?: unknown;
    };
    error.status = mapped.code === "rate_limited"
      ? 429
      : mapped.code === "ticker_not_found"
        ? 404
        : mapped.code === "bad_request"
          ? 400
          : 502;
    error.code = mapped.code;
    error.details = mapped.details;
    throw error;
  }
};

const fetchIntradayForTickers = async (
  tickers: string[],
  interval: YahooChartInterval,
): Promise<TickerResult[]> => {
  const period2 = new Date();
  const period1 = new Date(period2.getTime() - INTRADAY_LOOKBACK_MS);

  return mapPool(tickers, YAHOO_CONCURRENCY, async (ticker) => {
    try {
      const bars = await fetchIntradayBars(ticker, interval, period1, period2);
      return {
        ticker,
        count: bars.length,
        data: bars,
      } satisfies TickerResult;
    } catch (error) {
      return {
        ticker,
        count: 0,
        data: [],
        error: toTickerError(error),
      } satisfies TickerResult;
    }
  });
};

const fetchHistoryForTickers = async (
  tickers: string[],
  from: string,
  to: string,
): Promise<TickerResult[]> => {
  const serviceClient = createServiceClient();

  let cachedByTicker = new Map<string, ResponseBar[]>();
  if (serviceClient) {
    const loaded = await loadCachedBarsForTickers(serviceClient, tickers, from, to);
    if (loaded) {
      cachedByTicker = loaded;
    } else {
      for (const ticker of tickers) cachedByTicker.set(ticker, []);
    }
  } else {
    for (const ticker of tickers) cachedByTicker.set(ticker, []);
  }

  const missingTickers: string[] = [];
  const staleTickers: string[] = [];

  for (const ticker of tickers) {
    const cached = cachedByTicker.get(ticker) ?? [];
    if (cached.length === 0) {
      missingTickers.push(ticker);
      continue;
    }
    const latest = cached[cached.length - 1]?.[0];
    if (!latest || !isCacheFresh(latest)) {
      staleTickers.push(ticker);
    }
  }

  // Warm path: return DB cache immediately. Refresh stale tickers after the response.
  if (staleTickers.length > 0 && serviceClient) {
    scheduleBackground(
      mapPool(staleTickers, YAHOO_CONCURRENCY, async (ticker) => {
        try {
          await getBarsWithCache(
            ticker,
            from,
            to,
            serviceClient,
            responseBarsToStockBars(cachedByTicker.get(ticker) ?? []),
          );
        } catch (error) {
          console.error(`background refresh failed for ${ticker}:`, error);
        }
      }),
    );
  }

  const missingResults = missingTickers.length === 0
    ? []
    : await mapPool(missingTickers, YAHOO_CONCURRENCY, async (ticker) => {
      try {
        const bars = await getBarsWithCache(
          ticker,
          from,
          to,
          serviceClient,
          [],
        );
        return {
          ticker,
          count: bars.length,
          data: bars.map(toResponseBar),
        } satisfies TickerResult;
      } catch (error) {
        return {
          ticker,
          count: 0,
          data: [],
          error: toTickerError(error),
        } satisfies TickerResult;
      }
    });

  const missingByTicker = new Map(missingResults.map((result) => [result.ticker, result]));

  return tickers.map((ticker) => {
    const missing = missingByTicker.get(ticker);
    if (missing) return missing;

    const cached = cachedByTicker.get(ticker) ?? [];
    return {
      ticker,
      count: cached.length,
      data: cached,
    };
  });
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Use GET or POST for this endpoint.");
  }

  const url = new URL(request.url);
  const body = request.method === "POST" ? await parseRequestBody(request) : null;
  const tickers = getTickersFromBody(body, url);
  const chartInterval = parseYahooInterval(body, url);
  if (tickers.length === 0) {
    return errorResponse(
      400,
      "invalid_ticker",
      "Provide valid ticker(s) via body.ticker, body.tickers, or query `ticker`/`tickers`.",
    );
  }

  if (tickers.length > MAX_TICKERS_PER_REQUEST) {
    return errorResponse(
      400,
      "too_many_tickers",
      `Request at most ${MAX_TICKERS_PER_REQUEST} tickers per call.`,
    );
  }

  const isIntraday = INTRADAY_INTERVALS.has(chartInterval);
  const { from, to } = getDateRange();
  const isSingleTickerRequest = tickers.length === 1;

  console.log("date range:", { from, to, tickers, interval: chartInterval });

  try {
    const results = isIntraday
      ? await fetchIntradayForTickers(tickers, chartInterval)
      : await fetchHistoryForTickers(tickers, from, to);

    // Keep the legacy single-ticker payload so existing clients keep working.
    if (isSingleTickerRequest) {
      const [result] = results;
      if (result.error && result.data.length === 0) {
        const status = result.error.code === "rate_limited"
          ? 429
          : result.error.code === "ticker_not_found"
            ? 404
            : result.error.code === "bad_request"
              ? 400
              : 502;
        return errorResponse(status, result.error.code, result.error.message);
      }

      return jsonResponse(200, {
        ticker: result.ticker,
        from: isIntraday ? undefined : from,
        to: isIntraday ? undefined : to,
        interval: chartInterval,
        count: result.count,
        data: result.data,
      });
    }

    return jsonResponse(200, {
      from: isIntraday ? undefined : from,
      to: isIntraday ? undefined : to,
      interval: chartInterval,
      count: results.length,
      results,
    });
  } catch (error) {
    const status =
      typeof error === "object" &&
        error &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : 502;

    const code =
      typeof error === "object" &&
        error &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : "fetch_failed";

    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch stock history from Yahoo Finance.";

    const details =
      typeof error === "object" && error && "details" in error
        ? (error as { details?: unknown }).details
        : undefined;

    return errorResponse(status, code, message, details);
  }
});
