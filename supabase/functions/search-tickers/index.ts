// @ts-ignore: Resolved by Deno's npm specifier support in Supabase Edge runtime.
import YahooFinance from "npm:yahoo-finance2";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: {
    logErrors: false,
  },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

const ALLOWED_QUOTE_TYPES = new Set(["EQUITY", "ETF", "CRYPTOCURRENCY"]);
const MAX_RESULTS = 8;
const MAX_QUERY_LENGTH = 50;

export type TickerSearchResult = {
  symbol: string;
  name: string;
  exchange: string;
  quoteType: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toStr(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isPreferredListing(symbol: string): boolean {
  const normalized = symbol.toUpperCase();
  if (!normalized.includes(".")) return true;
  if (normalized.endsWith("-USD")) return true;
  if (normalized.endsWith(".RO")) return true;
  return false;
}

function rankQuote(symbol: string, query: string): number {
  const q = query.trim().toUpperCase();
  const s = symbol.toUpperCase();
  const preferred = isPreferredListing(s);
  if (s === q) return 0;
  if (preferred && s.startsWith(q)) return 1;
  if (preferred) return 2;
  if (s.startsWith(q)) return 3;
  return 4;
}

function mapQuote(raw: unknown): TickerSearchResult | null {
  const quote = asRecord(raw);
  const symbol = toStr(quote.symbol)?.toUpperCase();
  const quoteType = toStr(quote.quoteType)?.toUpperCase();
  if (!symbol || !quoteType || !ALLOWED_QUOTE_TYPES.has(quoteType)) return null;

  return {
    symbol,
    name: toStr(quote.longname) ?? toStr(quote.shortname) ?? symbol,
    exchange: toStr(quote.exchDisp) ?? toStr(quote.exchange) ?? "",
    quoteType,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const body = await req.json();
    const query = toStr(body?.query);

    if (!query || query.length > MAX_QUERY_LENGTH) {
      return jsonResponse({ error: "query is required" }, 400);
    }

    const result = await yahooFinance.search(query, {
      quotesCount: 12,
      newsCount: 0,
      enableFuzzyQuery: true,
    });

    const seen = new Set<string>();
    const quotes = (Array.isArray(result?.quotes) ? result.quotes : [])
      .map(mapQuote)
      .filter((item): item is TickerSearchResult => {
        if (!item || seen.has(item.symbol)) return false;
        seen.add(item.symbol);
        return true;
      })
      .sort((a, b) => rankQuote(a.symbol, query) - rankQuote(b.symbol, query))
      .slice(0, MAX_RESULTS);

    return jsonResponse({ results: quotes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});
