-- Fix transaction_type: update constraint from buy/sell to stock/crypto
ALTER TABLE positions DROP CONSTRAINT positions_transaction_type_check;
ALTER TABLE positions ADD CONSTRAINT positions_transaction_type_check 
  CHECK (transaction_type IN ('stock', 'crypto'));