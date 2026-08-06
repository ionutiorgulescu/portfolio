// @ts-ignore: Resolved by Deno's npm specifier support in Supabase Edge runtime.
import YahooFinance from "npm:yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuoteResult {
  symbol: string;
  regularMarketPrice: number;
  regularMarketPreviousClose: number | null;
  regularMarketChangePercent: number | null;
  marketState: string;
  postMarketPrice: number | null;
  postMarketChange: number | null;
  postMarketChangePercent: number | null;
  postMarketTime: string | null;
  preMarketPrice: number | null;
  preMarketChange: number | null;
  preMarketChangePercent: number | null;
  preMarketTime: string | null;
  extendedMarketPrice: number | null;
  extendedMarketChange: number | null;
  extendedMarketChangePercent: number | null;
  extendedMarketTime: string | null;
}

// Local fallback type for editors/linters that are not configured with Deno libs.
declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

type YahooQuote = Record<string, unknown> & {
  symbol?: string;
  marketState?: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketChangePercent?: number;
  preMarketPrice?: number;
  preMarketChange?: number;
  preMarketChangePercent?: number;
  preMarketTime?: Date | string | number;
  postMarketPrice?: number;
  postMarketChange?: number;
  postMarketChangePercent?: number;
  postMarketTime?: Date | string | number;
  extendedMarketPrice?: number;
  extendedMarketChange?: number;
  extendedMarketChangePercent?: number;
  extendedMarketTime?: Date | string | number;
};

function toIso(value: unknown): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isExtendedSession(marketState: string): boolean {
  const state = marketState.toUpperCase();
  return state === "PRE" || state === "PREPRE" || state === "POST" || state === "POSTPOST";
}

function isPreSession(marketState: string): boolean {
  const state = marketState.toUpperCase();
  return state === "PRE" || state === "PREPRE";
}

function mapYahooQuote(q: YahooQuote): QuoteResult {
  return {
    symbol: String(q.symbol ?? ""),
    regularMarketPrice: toNum(q.regularMarketPrice) ?? 0,
    regularMarketPreviousClose: toNum(q.regularMarketPreviousClose),
    regularMarketChangePercent: toNum(q.regularMarketChangePercent),
    marketState: String(q.marketState ?? "CLOSED"),
    postMarketPrice: toNum(q.postMarketPrice),
    postMarketChange: toNum(q.postMarketChange),
    postMarketChangePercent: toNum(q.postMarketChangePercent),
    postMarketTime: toIso(q.postMarketTime),
    preMarketPrice: toNum(q.preMarketPrice),
    preMarketChange: toNum(q.preMarketChange),
    preMarketChangePercent: toNum(q.preMarketChangePercent),
    preMarketTime: toIso(q.preMarketTime),
    extendedMarketPrice: toNum(q.extendedMarketPrice),
    extendedMarketChange: toNum(q.extendedMarketChange),
    extendedMarketChangePercent: toNum(q.extendedMarketChangePercent),
    extendedMarketTime: toIso(q.extendedMarketTime),
  };
}

function hasSessionPrice(quote: QuoteResult): boolean {
  if (isPreSession(quote.marketState)) {
    return quote.preMarketPrice != null || quote.extendedMarketPrice != null;
  }
  return quote.postMarketPrice != null || quote.extendedMarketPrice != null;
}

/**
 * Yahoo's quote() often omits pre/post fields; quoteSummary.price is richer.
 * Only promote the price that matches the current session — never use leftover
 * overnight postMarket as a PRE price (that made values wrong this morning).
 */
async function enrichFromQuoteSummary(quote: QuoteResult): Promise<QuoteResult> {
  try {
    const summary = await yahooFinance.quoteSummary(quote.symbol, { modules: ["price"] });
    const price = (summary?.price ?? {}) as YahooQuote;
    const marketState = String(price.marketState ?? quote.marketState);

    const preMarketPrice = toNum(price.preMarketPrice) ?? quote.preMarketPrice;
    const postMarketPrice = toNum(price.postMarketPrice) ?? quote.postMarketPrice;
    const yahooExtended = toNum(price.extendedMarketPrice) ?? quote.extendedMarketPrice;

    // Session-correct extended price only.
    const extendedMarketPrice = isPreSession(marketState)
      ? (yahooExtended ?? preMarketPrice)
      : (yahooExtended ?? postMarketPrice);

    return {
      ...quote,
      marketState,
      regularMarketPrice: toNum(price.regularMarketPrice) ?? quote.regularMarketPrice,
      regularMarketPreviousClose:
        toNum(price.regularMarketPreviousClose) ?? quote.regularMarketPreviousClose,
      regularMarketChangePercent:
        toNum(price.regularMarketChangePercent) ?? quote.regularMarketChangePercent,
      preMarketPrice,
      preMarketChange: toNum(price.preMarketChange) ?? quote.preMarketChange,
      preMarketChangePercent:
        toNum(price.preMarketChangePercent) ?? quote.preMarketChangePercent,
      preMarketTime: toIso(price.preMarketTime) ?? quote.preMarketTime,
      postMarketPrice,
      postMarketChange: toNum(price.postMarketChange) ?? quote.postMarketChange,
      postMarketChangePercent:
        toNum(price.postMarketChangePercent) ?? quote.postMarketChangePercent,
      postMarketTime: toIso(price.postMarketTime) ?? quote.postMarketTime,
      extendedMarketPrice,
      extendedMarketChange: toNum(price.extendedMarketChange) ?? quote.extendedMarketChange,
      extendedMarketChangePercent:
        toNum(price.extendedMarketChangePercent) ?? quote.extendedMarketChangePercent,
      extendedMarketTime: toIso(price.extendedMarketTime) ?? quote.extendedMarketTime,
    };
  } catch {
    return quote;
  }
}

type FmpAftermarketQuote = {
  symbol?: string;
  bidPrice?: number;
  askPrice?: number;
  price?: number;
  timestamp?: number;
};

function midFromFmpRow(
  row: FmpAftermarketQuote | null | undefined,
): { price: number; time: string | null } | null {
  if (!row) return null;

  const bid = toNum(row.bidPrice);
  const ask = toNum(row.askPrice);
  const direct = toNum(row.price);

  let price: number | null = null;
  if (bid != null && ask != null && bid > 0 && ask > 0) {
    price = (bid + ask) / 2;
  } else {
    price = direct ?? bid ?? ask;
  }

  if (price == null || price <= 0) return null;

  const time = row.timestamp != null ? toIso(row.timestamp * 1000) : null;
  return { price, time };
}

function isFmpLimitPayload(data: unknown): boolean {
  if (data == null) return false;
  const text = typeof data === "string" ? data : JSON.stringify(data);
  return /limit reach|rate limit|exceeded/i.test(text);
}

/**
 * Yahoo free quote endpoints frequently return marketState=PRE/POST with null
 * session prices. One FMP batch call covers all missing symbols when configured.
 * Returns null when FMP is rate-limited / errored so callers can skip it fast.
 */
async function fetchFmpAftermarketMids(
  symbols: string[],
  apiKey: string,
): Promise<Map<string, { price: number; time: string | null }> | null> {
  const result = new Map<string, { price: number; time: string | null }>();
  if (symbols.length === 0) return result;

  const url =
    `https://financialmodelingprep.com/stable/batch-aftermarket-quote` +
    `?symbols=${encodeURIComponent(symbols.join(","))}` +
    `&apikey=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json() as FmpAftermarketQuote[] | FmpAftermarketQuote | { message?: string };
  if (isFmpLimitPayload(data)) return null;

  const rows = Array.isArray(data) ? data : [data as FmpAftermarketQuote];

  for (const row of rows) {
    const symbol = row.symbol?.toUpperCase();
    if (!symbol) continue;
    const mid = midFromFmpRow(row);
    if (mid) result.set(symbol, mid);
  }

  return result;
}

function applyExtendedPrice(
  quote: QuoteResult,
  sessionPrice: number,
  sessionTime: string | null,
): QuoteResult {
  const baseline =
    quote.regularMarketPrice > 0
      ? quote.regularMarketPrice
      : (quote.regularMarketPreviousClose ?? 0);
  const change = baseline > 0 ? sessionPrice - baseline : null;
  const changePercent = baseline > 0 && change != null ? (change / baseline) * 100 : null;

  if (isPreSession(quote.marketState)) {
    return {
      ...quote,
      preMarketPrice: sessionPrice,
      preMarketChange: change,
      preMarketChangePercent: changePercent,
      preMarketTime: sessionTime,
      extendedMarketPrice: sessionPrice,
      extendedMarketChange: change,
      extendedMarketChangePercent: changePercent,
      extendedMarketTime: sessionTime,
    };
  }

  return {
    ...quote,
    postMarketPrice: sessionPrice,
    postMarketChange: change,
    postMarketChangePercent: changePercent,
    postMarketTime: sessionTime,
    extendedMarketPrice: sessionPrice,
    extendedMarketChange: change,
    extendedMarketChangePercent: changePercent,
    extendedMarketTime: sessionTime,
  };
}

async function enrichMissingSessionPrices(
  quotes: QuoteResult[],
  fmpApiKey: string | undefined,
): Promise<QuoteResult[]> {
  const needsEnrichment = quotes.filter(
    (q) => isExtendedSession(q.marketState) && !hasSessionPrice(q),
  );

  if (needsEnrichment.length === 0) return quotes;

  const bySymbol = new Map<string, QuoteResult>();
  let fmpUnavailable = false;

  // Prefer one FMP batch request (live mid) over N Yahoo quoteSummary calls.
  if (fmpApiKey) {
    try {
      const fmpMids = await fetchFmpAftermarketMids(
        needsEnrichment.map((q) => q.symbol),
        fmpApiKey,
      );

      if (fmpMids == null) {
        // Rate limit / error — keep Yahoo quote() as-is (fast + correct).
        // Client falls back to regularMarketPrice until a real PRE/POST print exists.
        fmpUnavailable = true;
      } else {
        for (const quote of needsEnrichment) {
          const fmp = fmpMids.get(quote.symbol.toUpperCase());
          if (fmp) {
            bySymbol.set(quote.symbol, applyExtendedPrice(quote, fmp.price, fmp.time));
          }
        }
      }
    } catch {
      fmpUnavailable = true;
    }
  }

  // Only hit Yahoo quoteSummary when FMP isn't configured, or for symbols FMP missed.
  // Never do N quoteSummary calls after an FMP rate-limit — that was today's slowness.
  const stillMissing = fmpUnavailable
    ? []
    : needsEnrichment.filter((q) => !bySymbol.has(q.symbol));

  if (stillMissing.length > 0) {
    const yahooEnriched = await Promise.all(
      stillMissing.map(async (quote) => {
        const next = await enrichFromQuoteSummary(quote);
        return [quote.symbol, next] as const;
      }),
    );

    for (const [symbol, next] of yahooEnriched) {
      bySymbol.set(symbol, next);
    }
  }

  return quotes.map((q) => bySymbol.get(q.symbol) ?? q);
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const tickers: string[] = body?.tickers;

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return new Response(JSON.stringify({ error: "tickers must be a non-empty array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = await yahooFinance.quote(tickers);
    const results = (Array.isArray(raw) ? raw : [raw]) as YahooQuote[];
    const mapped = results.map(mapYahooQuote);
    const fmpApiKey = Deno.env.get("FMP_API_KEY");
    const quotes = await enrichMissingSessionPrices(mapped, fmpApiKey);

    return new Response(JSON.stringify(quotes), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
