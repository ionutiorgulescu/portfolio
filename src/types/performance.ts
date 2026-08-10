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

/** Combined output of the FIFO engine. */
export interface FifoEngineResult {
  dailyHoldings: DailyHoldings;
  dailyCostBasis: DailyCostBasis;
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

/** Shape returned by the `usePortfolioPerformance` hook. */
export interface UsePortfolioPerformanceResult {
  data: PortfolioDataPoint[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}
