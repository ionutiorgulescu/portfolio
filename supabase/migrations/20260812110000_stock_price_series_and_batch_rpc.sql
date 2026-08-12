-- Drop redundant index (PK already covers ticker, trade_date).
DROP INDEX IF EXISTS idx_stock_price_history_ticker_date;

-- One row per ticker with pre-aggregated close series for fast batch reads.
CREATE TABLE stock_price_series (
  ticker      TEXT        PRIMARY KEY,
  latest_date DATE,
  bars        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stock_price_series ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: service role only (edge function).

-- Rebuild one ticker's compact series from daily bars.
CREATE OR REPLACE FUNCTION public.rebuild_stock_price_series(p_ticker text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO stock_price_series AS s (ticker, latest_date, bars, updated_at)
  SELECT
    p_ticker,
    max(h.trade_date),
    coalesce(
      jsonb_agg(jsonb_build_array(h.trade_date, h.close) ORDER BY h.trade_date),
      '[]'::jsonb
    ),
    now()
  FROM stock_price_history h
  WHERE h.ticker = p_ticker
  ON CONFLICT (ticker) DO UPDATE
  SET
    latest_date = EXCLUDED.latest_date,
    bars = EXCLUDED.bars,
    updated_at = EXCLUDED.updated_at;
$$;

REVOKE ALL ON FUNCTION public.rebuild_stock_price_series(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rebuild_stock_price_series(text) TO service_role;

-- Batch fallback: aggregate many tickers in one Postgres round-trip.
CREATE OR REPLACE FUNCTION public.get_stock_price_history_batch(
  p_tickers text[],
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT jsonb_object_agg(sub.ticker, sub.bars)
      FROM (
        SELECT
          h.ticker,
          jsonb_agg(
            jsonb_build_array(h.trade_date, h.close)
            ORDER BY h.trade_date
          ) AS bars
        FROM stock_price_history h
        WHERE h.ticker = ANY (p_tickers)
          AND h.trade_date >= p_from
          AND h.trade_date < p_to
        GROUP BY h.ticker
      ) AS sub
    ),
    '{}'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION public.get_stock_price_history_batch(text[], date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stock_price_history_batch(text[], date, date) TO service_role;

-- Backfill series from any rows already cached.
INSERT INTO stock_price_series (ticker, latest_date, bars, updated_at)
SELECT
  h.ticker,
  max(h.trade_date),
  jsonb_agg(jsonb_build_array(h.trade_date, h.close) ORDER BY h.trade_date),
  now()
FROM stock_price_history h
GROUP BY h.ticker
ON CONFLICT (ticker) DO UPDATE
SET
  latest_date = EXCLUDED.latest_date,
  bars = EXCLUDED.bars,
  updated_at = EXCLUDED.updated_at;
