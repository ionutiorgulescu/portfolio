-- Allow 'etf' as a position transaction type.
ALTER TABLE positions DROP CONSTRAINT positions_transaction_type_check;
ALTER TABLE positions ADD CONSTRAINT positions_transaction_type_check
  CHECK (transaction_type IN ('stock', 'crypto', 'etf'));
