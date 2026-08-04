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
  const tickerPattern = /^[A-Z0-9.-]{1,15}$/;
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

const getTickerFromRequest = async (request: Request): Promise<string | null> => {
  const url = new URL(request.url);
  const queryTicker = url.searchParams.get("ticker");

  let bodyTicker: string | null = null;
  if (request.method === "POST") {
    const body = await parseRequestBody(request);
    if (body && typeof body.ticker === "string") {
      bodyTicker = body.ticker;
    }
  }

  const rawTicker = bodyTicker ?? queryTicker;
  if (!rawTicker) return null;
  return normalizeTicker(rawTicker);
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
      .filter((bar) => bar.close > 0 && bar.volume > 0)
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Use GET or POST for this endpoint.");
  }

  // ✅ Auth guard — works with new sb_publishable_... key system
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse(401, "unauthorized", "Missing Authorization header.");
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );

  if (authError || !user) {
    return errorResponse(401, "unauthorized", "Invalid or expired token.");
  }

  // ✅ User is authenticated, proceed
  const ticker = await getTickerFromRequest(request);
  if (!ticker) {
    return errorResponse(
      400,
      "invalid_ticker",
      "Provide a valid ticker via body.ticker or query parameter `ticker`.",
    );
  }

  const { from, to } = getDateRange();

  console.log("date range:", { from, to });

  try {
    const bars = await fetchAllBars(ticker, from, to);
    return jsonResponse(200, {
      ticker,
      from,
      to,
      count: bars.length,
      data: bars,
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