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

type CacheEntry = {
  logo: string | null;
  expiresAt: number;
};

/** In-memory cache shared across warm isolates. Logos rarely change. */
const logoCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const normalizeTicker = (value: string): string | null => {
  const ticker = value.trim().toUpperCase();
  const tickerPattern = /^[A-Z0-9.-]{1,15}$/;
  return tickerPattern.test(ticker) ? ticker : null;
};

const getCachedLogo = (ticker: string): string | null | undefined => {
  const entry = logoCache.get(ticker);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    logoCache.delete(ticker);
    return undefined;
  }
  return entry.logo;
};

const setCachedLogo = (ticker: string, logo: string | null): void => {
  logoCache.set(ticker, { logo, expiresAt: Date.now() + CACHE_TTL_MS });
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

    const token = Deno.env.get('FINNHUB_API_KEY');
    if (!token) {
      return new Response(JSON.stringify({ error: 'FINNHUB_API_KEY is not configured' }), {
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

    const results: LogoResult[] = await Promise.all(
      tickers.map(async (ticker) => {
        const cached = getCachedLogo(ticker);
        if (cached !== undefined) {
          return { ticker, logo: cached };
        }

        try {
          const logo = await fetchLogoFromFinnhub(ticker, token);
          setCachedLogo(ticker, logo);
          return { ticker, logo };
        } catch {
          setCachedLogo(ticker, null);
          return { ticker, logo: null };
        }
      }),
    );

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
