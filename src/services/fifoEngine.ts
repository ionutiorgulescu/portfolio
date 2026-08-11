import type {
  DailyCostBasis,
  DailyHoldings,
  DailyTickerCost,
  FifoEngineResult,
  Lot,
  LotQueues,
  RealizedGainEvent,
  Transaction,
} from '../types/performance';
import { Currency, PositionStatus } from '../types/positions';

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

type ConsumeResult = {
  quantity: number;
  cost: number;
  currency: Currency;
};

/**
 * Consumes `sellQty` shares from the front of `queue` using FIFO.
 * Mutates the queue in place (partial lot support: the front lot's
 * remainingQty is reduced rather than removed when only partially consumed).
 * Logs a warning if the queue is exhausted before all shares are consumed.
 * Returns matched quantity and purchase-cost basis of the consumed lots.
 */
function consumeFifo(
  queue: Lot[],
  sellQty: number,
  ticker: string,
  date: string,
): ConsumeResult {
  let remaining = sellQty;
  let cost = 0;
  let quantity = 0;
  let currency: Currency = Currency.USD;
  const EPSILON = 1e-10;

  while (remaining > EPSILON) {
    if (queue.length === 0) {
      console.warn(`[FIFO] Over-sold ${ticker} by ${remaining} shares on ${date}`);
      break;
    }

    const front = queue[0];
    currency = front.currency;

    if (front.remainingQty <= remaining) {
      cost += front.remainingQty * front.buyPrice;
      quantity += front.remainingQty;
      remaining -= front.remainingQty;
      queue.shift();
    } else {
      cost += remaining * front.buyPrice;
      quantity += remaining;
      front.remainingQty -= remaining;
      remaining = 0;
    }
  }

  return { quantity, cost, currency };
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
    return {
      dailyHoldings: new Map(),
      dailyCostBasis: new Map(),
      dailyTickerCost: new Map(),
      realizedGains: [],
    };
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
  const dailyTickerCost: DailyTickerCost = new Map();
  const realizedGains: RealizedGainEvent[] = [];

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
          currency: (tx.currency as Currency) ?? Currency.USD,
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
        const matched = consumeFifo(queue, tx.quantity, tx.ticker_symbol, date);
        if (matched.quantity <= 1e-10) continue;

        const proceeds = matched.quantity * tx.price;
        realizedGains.push({
          date,
          ticker: tx.ticker_symbol,
          quantity: matched.quantity,
          proceeds,
          cost: matched.cost,
          gain: proceeds - matched.cost,
          currency: matched.currency,
        });
      }
    }

    // End-of-day snapshot: record remaining shares and cost basis for every active ticker
    const snapshot = new Map<string, number>();
    const tickerCost = new Map<string, number>();
    let usdCostBasis = 0;
    let ronCostBasis = 0;
    for (const [ticker, lots] of lotQueues) {
      const total = lots.reduce((sum, lot) => sum + lot.remainingQty, 0);
      let remainingCost = 0;
      for (const lot of lots) {
        if (lot.remainingQty > 1e-10) {
          const lotCost = lot.remainingQty * lot.buyPrice;
          remainingCost += lotCost;
          if (lot.currency === Currency.RON) {
            ronCostBasis += lotCost;
          } else {
            usdCostBasis += lotCost;
          }
        }
      }
      if (total > 0) {
        snapshot.set(ticker, total);
        tickerCost.set(ticker, remainingCost);
      }
    }
    dailyHoldings.set(date, snapshot);
    dailyCostBasis.set(date, { usd: usdCostBasis, ron: ronCostBasis });
    dailyTickerCost.set(date, tickerCost);
  }

  return { dailyHoldings, dailyCostBasis, dailyTickerCost, realizedGains };
}
