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

type JsonRecord = Record<string, unknown>;

export type TickerFundamentals = {
  ticker: string;
  name: string;
  currency: string;
  price: number | null;
  changePercent: number | null;
  marketState: string | null;
  preMarketPrice: number | null;
  postMarketPrice: number | null;
  extendedMarketPrice: number | null;
  preMarketChangePercent: number | null;
  postMarketChangePercent: number | null;
  extendedMarketChangePercent: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  open: number | null;
  previousClose: number | null;
  marketCap: number | null;
  epsTtm: number | null;
  floatShares: number | null;
  peRatioTtm: number | null;
  revenueTtm: number | null;
  ebitdaTtm: number | null;
  freeCashflowTtm: number | null;
};

const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.=^-]{0,19}$/;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "object" && value !== null && "raw" in value) {
    return toNum((value as { raw: unknown }).raw);
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStr(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickNum(...values: unknown[]): number | null {
  for (const value of values) {
    const n = toNum(value);
    if (n != null) return n;
  }
  return null;
}

function pickStr(...values: unknown[]): string | null {
  for (const value of values) {
    const s = toStr(value);
    if (s) return s;
  }
  return null;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function normalizeTicker(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const ticker = value.trim().toUpperCase();
  return TICKER_PATTERN.test(ticker) ? ticker : null;
}

async function fetchQuote(ticker: string): Promise<JsonRecord | null> {
  try {
    const raw = await yahooFinance.quote(ticker);
    const quote = Array.isArray(raw) ? raw[0] : raw;
    return asRecord(quote);
  } catch {
    return null;
  }
}

async function fetchQuoteSummary(ticker: string): Promise<JsonRecord | null> {
  try {
    const summary = await yahooFinance.quoteSummary(ticker, {
      modules: ["price", "summaryDetail", "defaultKeyStatistics", "financialData"],
    });
    return asRecord(summary);
  } catch {
    return null;
  }
}

function mapFundamentals(
  ticker: string,
  quote: JsonRecord,
  summary: JsonRecord,
): TickerFundamentals {
  const priceMod = asRecord(summary.price);
  const detail = asRecord(summary.summaryDetail);
  const stats = asRecord(summary.defaultKeyStatistics);
  const financials = asRecord(summary.financialData);

  const name =
    pickStr(quote.shortName, quote.displayName, quote.longName, priceMod.shortName, priceMod.longName, priceMod.displayName) ??
    ticker;

  const currency =
    pickStr(quote.currency, priceMod.currency, detail.currency) ?? "USD";

  const marketState = pickStr(quote.marketState, priceMod.marketState);
  const isPre = (marketState ?? "").toUpperCase() === "PRE";
  const preMarketPrice = pickNum(quote.preMarketPrice, priceMod.preMarketPrice);
  const postMarketPrice = pickNum(quote.postMarketPrice, priceMod.postMarketPrice);
  const yahooExtended = pickNum(quote.extendedMarketPrice, priceMod.extendedMarketPrice);
  const extendedMarketPrice = isPre
    ? (yahooExtended ?? preMarketPrice)
    : (yahooExtended ?? postMarketPrice);

  return {
    ticker,
    name,
    currency,
    price: pickNum(
      quote.regularMarketPrice,
      priceMod.regularMarketPrice,
      financials.currentPrice,
    ),
    changePercent: pickNum(
      quote.regularMarketChangePercent,
      priceMod.regularMarketChangePercent,
    ),
    marketState,
    preMarketPrice,
    postMarketPrice,
    extendedMarketPrice,
    preMarketChangePercent: pickNum(
      quote.preMarketChangePercent,
      priceMod.preMarketChangePercent,
    ),
    postMarketChangePercent: pickNum(
      quote.postMarketChangePercent,
      priceMod.postMarketChangePercent,
    ),
    extendedMarketChangePercent: pickNum(
      quote.extendedMarketChangePercent,
      priceMod.extendedMarketChangePercent,
    ),
    dayLow: pickNum(quote.regularMarketDayLow, quote.dayLow, detail.dayLow),
    dayHigh: pickNum(quote.regularMarketDayHigh, quote.dayHigh, detail.dayHigh),
    fiftyTwoWeekLow: pickNum(quote.fiftyTwoWeekLow, detail.fiftyTwoWeekLow),
    fiftyTwoWeekHigh: pickNum(quote.fiftyTwoWeekHigh, detail.fiftyTwoWeekHigh),
    open: pickNum(quote.regularMarketOpen, quote.open, detail.open),
    previousClose: pickNum(quote.regularMarketPreviousClose, detail.previousClose),
    marketCap: pickNum(quote.marketCap, detail.marketCap, priceMod.marketCap),
    epsTtm: pickNum(quote.epsTrailingTwelveMonths, stats.trailingEps),
    floatShares: pickNum(quote.floatShares, stats.floatShares),
    peRatioTtm: pickNum(quote.trailingPE, detail.trailingPE),
    revenueTtm: pickNum(financials.totalRevenue),
    ebitdaTtm: pickNum(financials.ebitda),
    freeCashflowTtm: pickNum(financials.freeCashflow),
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
    const ticker = normalizeTicker(body?.ticker);

    if (!ticker) {
      return jsonResponse({ error: "ticker is required" }, 400);
    }

    const [quote, summary] = await Promise.all([
      fetchQuote(ticker),
      fetchQuoteSummary(ticker),
    ]);

    if (!quote && !summary) {
      return jsonResponse({ error: `No fundamentals found for ${ticker}` }, 404);
    }

    return jsonResponse(mapFundamentals(ticker, quote ?? {}, summary ?? {}));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});
