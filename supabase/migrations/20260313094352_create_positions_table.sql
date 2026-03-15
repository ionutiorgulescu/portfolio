-- Create the 'position_status' enum type
CREATE TYPE position_status AS ENUM ('open', 'closed', 'pending', 'cancelled');

-- Create the 'positions' table
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker_symbol TEXT NOT NULL,
    asset_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL CHECK (quantity >= 0),
    buy_price NUMERIC NOT NULL CHECK (buy_price >= 0),
    buy_date DATE NOT NULL,
    currency TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status position_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create an index on the user_id for performance
CREATE INDEX idx_positions_user_id ON positions (user_id);

-- Create a function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger to automatically update 'updated_at' on row changes
CREATE TRIGGER update_positions_updated_at
BEFORE UPDATE ON positions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();