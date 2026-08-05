// @ts-ignore: Resolved by Deno's npm specifier support in Supabase Edge runtime.
import YahooFinance from "npm:yahoo-finance2";

const yahooFinance = new YahooFinance();
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuoteResult {
  symbol: string;
  regularMarketPrice: number;
  marketState: string;
  postMarketPrice: number | null;
  postMarketChange: number | null;
  postMarketChangePercent: number | null;
  postMarketTime: string | null;
  preMarketPrice: number | null;
  preMarketChange: number | null;
  preMarketChangePercent: number | null;
  preMarketTime: string | null;
}

// Local fallback type for editors/linters that are not configured with Deno libs.
declare const Deno: {
    serve: (handler: (request: Request) => Response | Promise<Response>) => void;
    env: {
      get: (key: string) => string | undefined;
    };
  };

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const tickers: string[] = body?.tickers;

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return new Response(JSON.stringify({ error: 'tickers must be a non-empty array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const raw = await yahooFinance.quote(tickers);
    const results = Array.isArray(raw) ? raw : [raw];

    const quotes: QuoteResult[] = results.map((q) => ({
      symbol: q.symbol,
      regularMarketPrice: q.regularMarketPrice ?? 0,
      marketState: q.marketState ?? 'CLOSED',
      postMarketPrice: q.postMarketPrice ?? null,
      postMarketChange: q.postMarketChange ?? null,
      postMarketChangePercent: q.postMarketChangePercent ?? null,
      postMarketTime: q.postMarketTime ? new Date(q.postMarketTime).toISOString() : null,
      preMarketPrice: q.preMarketPrice ?? null,
      preMarketChange: q.preMarketChange ?? null,
      preMarketChangePercent: q.preMarketChangePercent ?? null,
      preMarketTime: q.preMarketTime ? new Date(q.preMarketTime).toISOString() : null,
    }));

    return new Response(JSON.stringify(quotes), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});