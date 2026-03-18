-- ============================================================
-- Migration: Add multi-portfolio support
-- ============================================================

-- 1. Create portfolios table
CREATE TABLE portfolios (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS on portfolios
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own portfolios"
  ON portfolios FOR ALL
  USING (auth.uid() = user_id);

-- 3. Add portfolio_id to positions (nullable first, for migration)
ALTER TABLE positions
  ADD COLUMN portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE;

-- 4. Create a default portfolio for every existing user
INSERT INTO portfolios (user_id, name)
SELECT DISTINCT user_id, 'Ionut Portfolio'
FROM positions;

-- 5. Assign all existing positions to their user's default portfolio
UPDATE positions p
SET portfolio_id = (
  SELECT po.id
  FROM portfolios po
  WHERE po.user_id = p.user_id
  LIMIT 1
);

-- 6. Now that all rows are populated, enforce NOT NULL
ALTER TABLE positions
  ALTER COLUMN portfolio_id SET NOT NULL;

-- 7. Indexes for performance
CREATE INDEX idx_positions_portfolio_id ON positions(portfolio_id);
CREATE INDEX idx_portfolios_user_id     ON portfolios(user_id);

-- 8. Auto-update updated_at on portfolios
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER portfolios_updated_at
  BEFORE UPDATE ON portfolios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();