import type { Currency, Position } from './positions';

/**
 * A single row from the `positions` table that has been filtered to
 * status IN ('open', 'closed'). The `transaction_type` field distinguishes
 * a buy lot entry from a sell transaction.
 */
export type Transaction = Position;

/**
 * A single open buy lot that is being tracked through FIFO consumption.
 * `remainingQty` decreases as sell transactions consume it.
 */
export interface Lot {
  lotId: string;
  ticker: string;
  openDate: string;     // 'YYYY-MM-DD'
  remainingQty: number; // shares not yet consumed by sells
  buyPrice: number;
  currency: Currency;
}

/** Per-ticker FIFO queue: ticker → ordered list of open lots (oldest first). */
export type LotQueues = Map<string, Lot[]>;

/**
 * Daily holdings snapshot produced by the FIFO engine.
 * Maps 'YYYY-MM-DD' → (ticker → shares held).
 * Tickers with 0 remaining shares are omitted from the inner map.
 */
export type DailyHoldings = Map<string, Map<string, number>>;

/** Cost basis split by currency so RON can be converted to USD later. */
export type CostBasisParts = { usd: number; ron: number };

/**
 * Daily cost basis series produced by the FIFO engine.
 * Maps 'YYYY-MM-DD' → cost basis parts by currency.
 */
export type DailyCostBasis = Map<string, CostBasisParts>;

/**
 * Per-ticker cost basis for a day (native lot currency).
 * Maps 'YYYY-MM-DD' → (ticker → remaining cost).
 * Used to value holdings at cost when market prices are missing.
 */
export type DailyTickerCost = Map<string, Map<string, number>>;

/**
 * One sell matched against FIFO buy lots.
 * `gain` / `cost` / `proceeds` are in the lot's native currency.
 */
export interface RealizedGainEvent {
  date: string; // sell date 'YYYY-MM-DD'
  ticker: string;
  quantity: number;
  proceeds: number;
  cost: number;
  gain: number;
  currency: Currency;
}

/** Combined output of the FIFO engine. */
export interface FifoEngineResult {
  dailyHoldings: DailyHoldings;
  dailyCostBasis: DailyCostBasis;
  dailyTickerCost: DailyTickerCost;
  realizedGains: RealizedGainEvent[];
}

/**
 * Price lookup structure built from per-ticker historical bars.
 * Maps ticker → ('YYYY-MM-DD' → closing price).
 * Weekends and market holidays are filled via last-known-price carry-forward,
 * so every calendar date in the FIFO date range has an entry once the ticker
 * has its first available price.
 */
export type PriceMatrix = Map<string, Map<string, number>>;

/** A single point in the total portfolio value time series. */
export interface PortfolioDataPoint {
  date: string;      // 'YYYY-MM-DD'
  value: number;     // total USD value of all holdings on this date
  costBasis: number; // Σ (remainingQty × buyPrice) across all open lots on this date
}

/** Realized P&L for a sell, converted to display currency (USD when mixed). */
export interface RealizedGainPoint {
  date: string;
  gain: number;
  cost: number;
}

/**
 * External cash flow for money-weighted return (XIRR).
 * Negative = deposit / buy; positive = withdrawal / sell proceeds.
 */
export interface CashFlowPoint {
  date: string;
  amount: number;
}

/** Shape returned by the `usePortfolioPerformance` hook. */
export interface UsePortfolioPerformanceResult {
  data: PortfolioDataPoint[];
  realizedGains: RealizedGainPoint[];
  cashFlows: CashFlowPoint[];
  /** Calendar years from first buy through current year, newest first. */
  years: number[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}
