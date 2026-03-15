-- Add transaction_type column to distinguish buy vs sell transactions.
-- Defaults to 'buy' so existing rows remain valid.
ALTER TABLE positions
  ADD COLUMN transaction_type TEXT NOT NULL DEFAULT 'buy'
  CHECK (transaction_type IN ('buy', 'sell'));
