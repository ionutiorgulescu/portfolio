import type { DailyCostBasis, DailyHoldings, FifoEngineResult, Lot, LotQueues, Transaction } from '../types/performance';
import { PositionStatus } from '../types/positions';

function toUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Returns every calendar day between startIso and endIso inclusive. */
function buildDateRange(startIso: string, endIso: string): string[] {
  const dates: string[] = [];
  let current = toUtcDate(startIso);
  const end = toUtcDate(endIso);
  while (current <= end) {
    dates.push(toIsoDate(current));
    current = addUtcDays(current, 1);
  }
  return dates;
}

/**
 * Consumes `sellQty` shares from the front of `queue` using FIFO.
 * Mutates the queue in place (partial lot support: the front lot's
 * remainingQty is reduced rather than removed when only partially consumed).
 * Logs a warning if the queue is exhausted before all shares are consumed.
 */
function consumeFifo(queue: Lot[], sellQty: number, ticker: string, date: string): void {
  let remaining = sellQty;
  const EPSILON = 1e-10;

  while (remaining > EPSILON) {
    if (queue.length === 0) {
      console.warn(`[FIFO] Over-sold ${ticker} by ${remaining} shares on ${date}`);
      break;
    }

    const front = queue[0];

    if (front.remainingQty <= remaining) {
      remaining -= front.remainingQty;
      queue.shift();
    } else {
      front.remainingQty -= remaining;
      remaining = 0;
    }
  }
}

/**
 * Runs a FIFO engine over the full transaction list and returns a
 * `DailyHoldings` map — one end-of-day holdings snapshot per calendar
 * day from the earliest transaction date through today.
 *
 * Rules:
 * - Only transactions with `transaction_type === 'buy'` or `'sell'` are processed.
 * - On days with both buy and sell transactions, buys are applied first.
 * - A transaction on date X is reflected starting from X (end-of-day).
 * - Weekends and holidays produce a snapshot identical to the previous day
 *   (no transactions means no change to lotQueues).
 */
export function runFifoEngine(transactions: Transaction[]): FifoEngineResult {
  if (transactions.length === 0) {
    return { dailyHoldings: new Map(), dailyCostBasis: new Map() };
  }

  // Sort chronologically; buys before sells on the same date
  const sorted = [...transactions].sort((a, b) => {
    if (a.buy_date !== b.buy_date) {
      return a.buy_date < b.buy_date ? -1 : 1;
    }
    if (a.status === PositionStatus.Buy && b.status === PositionStatus.Sell) return -1;
    if (a.status === PositionStatus.Sell && b.status === PositionStatus.Buy) return 1;
    return 0;
  });

  // Group by date for O(1) per-day lookup
  const byDate = new Map<string, Transaction[]>();
  for (const tx of sorted) {
    const group = byDate.get(tx.buy_date) ?? [];
    group.push(tx);
    byDate.set(tx.buy_date, group);
  }

  const startDate = sorted[0].buy_date;
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const endDate = toIsoDate(yesterday);
  const dateRange = buildDateRange(startDate, endDate);

  const lotQueues: LotQueues = new Map();
  const dailyHoldings: DailyHoldings = new Map();
  const dailyCostBasis: DailyCostBasis = new Map();

  for (const date of dateRange) {
    const dayTxns = byDate.get(date) ?? [];

    for (const tx of dayTxns) {
      if (tx.status === PositionStatus.Buy) {
        const lot: Lot = {
          lotId: tx.id,
          ticker: tx.ticker_symbol,
          openDate: tx.buy_date,
          remainingQty: tx.quantity,
          buyPrice: tx.price,
        };
        const queue = lotQueues.get(tx.ticker_symbol) ?? [];
        queue.push(lot);
        lotQueues.set(tx.ticker_symbol, queue);
      } else if (tx.status === PositionStatus.Sell) {
        const queue = lotQueues.get(tx.ticker_symbol);
        if (!queue || queue.length === 0) {
          console.warn(`[FIFO] Sell without open lots for ${tx.ticker_symbol} on ${date}`);
          continue;
        }
        consumeFifo(queue, tx.quantity, tx.ticker_symbol, date);
      }
    }

    // End-of-day snapshot: record remaining shares and cost basis for every active ticker
    const snapshot = new Map<string, number>();
    let totalCostBasis = 0;
    for (const [ticker, lots] of lotQueues) {
      const total = lots.reduce((sum, lot) => sum + lot.remainingQty, 0);
      if (total > 0) {
        snapshot.set(ticker, total);
      }
      for (const lot of lots) {
        if (lot.remainingQty > 1e-10) {  // ← add this guard
          totalCostBasis += lot.remainingQty * lot.buyPrice;
        }
      }
      
    }
    dailyHoldings.set(date, snapshot);
    dailyCostBasis.set(date, totalCostBasis);
  }

  return { dailyHoldings, dailyCostBasis };
}
