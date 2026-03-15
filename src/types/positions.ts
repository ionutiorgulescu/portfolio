export const PositionStatus = {
  Buy: 'buy',
  Sell: 'sell',
} as const;
export const TransactionType = {
  Stock: 'stock',
  Crypto: 'crypto',
} as const;

export type PositionStatus = (typeof PositionStatus)[keyof typeof PositionStatus];
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export interface Position {
  id: string;
  ticker_symbol: string;
  asset_name: string;
  quantity: number;
  price: number;
  buy_date: string;
  currency: string;
  user_id: string;
  status: PositionStatus;
  transaction_type: TransactionType;
  created_at: string;
  updated_at: string; 
}
