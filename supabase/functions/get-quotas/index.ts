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
 * overnight postMarket as a PRE price.
 */
async function enrichFromQuoteSummary(quote: QuoteResult): Promise<QuoteResult> {
  try {
    const summary = await yahooFinance.quoteSummary(quote.symbol, { modules: ["price"] });
    const price = (summary?.price ?? {}) as YahooQuote;
    const marketState = String(price.marketState ?? quote.marketState);

    const preMarketPrice = toNum(price.preMarketPrice) ?? quote.preMarketPrice;
    const postMarketPrice = toNum(price.postMarketPrice) ?? quote.postMarketPrice;
    const yahooExtended = toNum(price.extendedMarketPrice) ?? quote.extendedMarketPrice;

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

async function enrichMissingSessionPrices(quotes: QuoteResult[]): Promise<QuoteResult[]> {
  const needsEnrichment = quotes.filter(
    (q) => isExtendedSession(q.marketState) && !hasSessionPrice(q),
  );

  if (needsEnrichment.length === 0) return quotes;

  const enrichedEntries = await Promise.all(
    needsEnrichment.map(async (quote) => {
      const next = await enrichFromQuoteSummary(quote);
      return [quote.symbol, next] as const;
    }),
  );

  const bySymbol = new Map(enrichedEntries);
  return quotes.map((q) => bySymbol.get(q.symbol) ?? q);
}

Deno.serve(async (req: Request) => {
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
    const quotes = await enrichMissingSessionPrices(mapped);

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
