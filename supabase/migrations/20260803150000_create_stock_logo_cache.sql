-- Shared Finnhub logo cache (persists across edge-function cold starts).
CREATE TABLE stock_logo_cache (
  ticker     TEXT        PRIMARY KEY,
  logo       TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_logo_cache_expires_at ON stock_logo_cache (expires_at);

ALTER TABLE stock_logo_cache ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: only the service role (edge function) can access.
-- Logos are public company assets cached server-side; clients get them via get-stock-logos.
