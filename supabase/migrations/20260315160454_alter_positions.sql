-- Fix status: change from enum to text with buy/sell constraint
ALTER TABLE positions 
  ALTER COLUMN status TYPE TEXT USING 'buy';

ALTER TABLE positions 
  ADD CONSTRAINT positions_status_check CHECK (status IN ('buy', 'sell'));

DROP TYPE position_status;