-- Shared Yahoo daily bar cache (persists across edge-function cold starts).
-- Clients never query this directly; fetch-stock-history reads/writes via service role.
CREATE TABLE stock_price_history (
  ticker     TEXT             NOT NULL,
  trade_date DATE             NOT NULL,
  timestamp  BIGINT           NOT NULL,
  open       DOUBLE PRECISION NOT NULL,
  high       DOUBLE PRECISION NOT NULL,
  low        DOUBLE PRECISION NOT NULL,
  close      DOUBLE PRECISION NOT NULL,
  volume     DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ      NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, trade_date)
);

CREATE INDEX idx_stock_price_history_ticker_date
  ON stock_price_history (ticker, trade_date);

ALTER TABLE stock_price_history ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: only the service role (edge function) can access.
