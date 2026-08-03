// @ts-ignore: Resolved by Deno's npm specifier support in Supabase Edge runtime.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Local fallback type for editors/linters that are not configured with Deno libs.
declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

type LogoResult = {
  ticker: string;
  logo: string | null;
};

type CacheRow = {
  ticker: string;
  logo: string | null;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const normalizeTicker = (value: string): string | null => {
  const ticker = value.trim().toUpperCase();
  const tickerPattern = /^[A-Z0-9.-]{1,15}$/;
  return tickerPattern.test(ticker) ? ticker : null;
};

const fetchLogoFromFinnhub = async (ticker: string, token: string): Promise<string | null> => {
  const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(token)}`;
  const response = await fetch(url);

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as { logo?: unknown };
  return typeof data.logo === 'string' && data.logo.length > 0 ? data.logo : null;
};

Deno.serve(async (req: Request) => {
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

    const finnhubToken = Deno.env.get('FINNHUB_API_KEY');
    if (!finnhubToken) {
      return new Response(JSON.stringify({ error: 'FINNHUB_API_KEY is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Supabase service credentials are not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const rawTickers: unknown[] = Array.isArray(body?.tickers) ? body.tickers : [];

    const tickers = [
      ...new Set(
        rawTickers
          .filter((t): t is string => typeof t === 'string')
          .map(normalizeTicker)
          .filter((t): t is string => t !== null),
      ),
    ];

    if (tickers.length === 0) {
      return new Response(JSON.stringify({ error: 'tickers must be a non-empty array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service role bypasses RLS — this table has no client-facing policies.
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: cachedRows, error: cacheReadError } = await supabase
      .from('stock_logo_cache')
      .select('ticker, logo')
      .in('ticker', tickers)
      .gt('expires_at', new Date().toISOString());

    if (cacheReadError) {
      throw new Error(`Logo cache read failed: ${cacheReadError.message}`);
    }

    const cachedByTicker = new Map<string, string | null>(
      ((cachedRows ?? []) as CacheRow[]).map((row) => [row.ticker, row.logo]),
    );

    const missingTickers = tickers.filter((ticker) => !cachedByTicker.has(ticker));

    if (missingTickers.length > 0) {
      const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
      const updatedAt = new Date().toISOString();

      const fetched = await Promise.all(
        missingTickers.map(async (ticker) => {
          try {
            const logo = await fetchLogoFromFinnhub(ticker, finnhubToken);
            return { ticker, logo };
          } catch {
            return { ticker, logo: null as string | null };
          }
        }),
      );

      const { error: cacheWriteError } = await supabase.from('stock_logo_cache').upsert(
        fetched.map(({ ticker, logo }) => ({
          ticker,
          logo,
          expires_at: expiresAt,
          updated_at: updatedAt,
        })),
        { onConflict: 'ticker' },
      );

      if (cacheWriteError) {
        throw new Error(`Logo cache write failed: ${cacheWriteError.message}`);
      }

      for (const item of fetched) {
        cachedByTicker.set(item.ticker, item.logo);
      }
    }

    const results: LogoResult[] = tickers.map((ticker) => ({
      ticker,
      logo: cachedByTicker.get(ticker) ?? null,
    }));

    return new Response(JSON.stringify(results), {
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
