export const PositionStatus = {
  Buy: 'buy',
  Sell: 'sell',
} as const;

export const TransactionType = {
  Stock: 'stock',
  Crypto: 'crypto',
} as const;

export const Currency = {
  USD: 'USD',
  RON: 'RON',
} as const;

export type PositionStatus = (typeof PositionStatus)[keyof typeof PositionStatus];
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];
export type Currency = (typeof Currency)[keyof typeof Currency];

export interface Position {
  id: string;
  ticker_symbol: string;
  asset_name: string;
  quantity: number;
  price: number;
  buy_date: string;
  currency: Currency;
  user_id: string;
  portfolio_id: string;
  status: PositionStatus;
  transaction_type: TransactionType;
  created_at: string;
  updated_at: string;
}

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}