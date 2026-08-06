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

/** Yahoo's quote() often omits pre/post fields; quoteSummary.price is richer. */
async function enrichFromQuoteSummary(quote: QuoteResult): Promise<QuoteResult> {
  try {
    const summary = await yahooFinance.quoteSummary(quote.symbol, { modules: ["price"] });
    const price = (summary?.price ?? {}) as YahooQuote;

    const preMarketPrice = toNum(price.preMarketPrice) ?? quote.preMarketPrice;
    const postMarketPrice = toNum(price.postMarketPrice) ?? quote.postMarketPrice;
    const extendedMarketPrice =
      toNum(price.extendedMarketPrice) ??
      quote.extendedMarketPrice ??
      preMarketPrice ??
      postMarketPrice;

    return {
      ...quote,
      marketState: String(price.marketState ?? quote.marketState),
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

/**
 * Yahoo free quote endpoints frequently return marketState=PRE/POST with null
 * session prices. FMP aftermarket bid/ask is a live fallback when configured.
 */
async function fetchFmpAftermarketMid(
  symbol: string,
  apiKey: string,
): Promise<{ price: number; time: string | null } | null> {
  const url =
    `https://financialmodelingprep.com/stable/aftermarket-quote` +
    `?symbol=${encodeURIComponent(symbol)}` +
    `&apikey=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json() as FmpAftermarketQuote[] | FmpAftermarketQuote;
  const row = Array.isArray(data) ? data[0] : data;
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

  const enrichedEntries = await Promise.all(
    needsEnrichment.map(async (quote) => {
      let next = await enrichFromQuoteSummary(quote);

      // quoteSummary often still only has yesterday's postMarket during PRE.
      // Prefer a live FMP aftermarket mid when available.
      if (fmpApiKey && isExtendedSession(next.marketState)) {
        try {
          const fmp = await fetchFmpAftermarketMid(next.symbol, fmpApiKey);
          if (fmp) {
            next = applyExtendedPrice(next, fmp.price, fmp.time);
            return [quote.symbol, next] as const;
          }
        } catch {
          // keep Yahoo enrichment
        }
      }

      // Last resort during PRE: reuse overnight postMarket as extended price so
      // portfolio value at least reflects the last extended print vs regular close.
      if (
        isPreSession(next.marketState) &&
        next.preMarketPrice == null &&
        next.extendedMarketPrice == null &&
        next.postMarketPrice != null
      ) {
        next = applyExtendedPrice(next, next.postMarketPrice, next.postMarketTime);
      }

      return [quote.symbol, next] as const;
    }),
  );

  const bySymbol = new Map(enrichedEntries);
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
