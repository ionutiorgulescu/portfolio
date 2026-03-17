ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own positions"
ON positions
FOR ALL
USING (auth.uid() = user_id);