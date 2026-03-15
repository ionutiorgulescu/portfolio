import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import { PositionStatus } from '../types/positions';
import type {
  PortfolioDataPoint,
  PriceMatrix,
  Transaction,
  UsePortfolioPerformanceResult,
} from '../types/performance';
import { fetchStockHistory } from './useStockData';
import { runFifoEngine } from '../services/fifoEngine';
import { buildPriceMatrix } from '../services/priceMatrix';
import { computePortfolioValue } from '../services/portfolioValue';

const fetchPerformanceTransactions = async (): Promise<Transaction[]> => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    if (userError.message === 'Auth session missing!') {
      throw new Error('Your session has expired. Please sign in again.');
    }
    throw userError;
  }

  if (!user) {
    throw new Error('You must be signed in to view portfolio performance.');
  }

  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .eq('user_id', user.id)
    .in('status', [PositionStatus.Open, PositionStatus.Closed])
    .order('buy_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []) as Transaction[];
};

/**
 * Orchestrates all data fetching and computation needed for the Portfolio
 * Performance page.
 *
 * Data flow:
 *   1. Fetch transactions (status: open | closed) from Supabase
 *   2. Derive unique tickers; fetch 10Y of daily prices for each in parallel
 *   3. Run the FIFO engine → DailyHoldings (memoized on transactions)
 *   4. Build PriceMatrix with carry-forward (memoized on prices + date range)
 *   5. Compute PortfolioDataPoint[] (memoized on holdings + matrix)
 *
 * All computation is deferred until prices are fully loaded so the chart
 * never renders a partial value series.
 */
export function usePortfolioPerformance(): UsePortfolioPerformanceResult {
  // ── Step 1: transactions ─────────────────────────────────────────────────
  const {
    data: transactions = [],
    isLoading: isLoadingTransactions,
    isError: isErrorTransactions,
    error: transactionsError,
  } = useQuery({
    queryKey: ['portfolio-performance-transactions'],
    queryFn: fetchPerformanceTransactions,
  });

  // ── Step 2: price history for every ticker, fired in parallel ────────────
  const uniqueTickers = useMemo(
    () => [...new Set(transactions.map((tx) => tx.ticker_symbol))],
    [transactions],
  );

  const priceQueries = useQueries({
    queries: uniqueTickers.map((ticker) => ({
      // Shares the same cache key as useStockData so pages don't double-fetch
      queryKey: ['stock-history', ticker] as const,
      queryFn: () => fetchStockHistory(ticker),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoadingPrices = priceQueries.some((q) => q.isLoading);
  const isErrorPrices = priceQueries.some((q) => q.isError);
  const pricesError = (priceQueries.find((q) => q.error)?.error ?? null) as Error | null;

  // ── Step 3: stable ticker → bars map (recomputes when any query settles) ──
  const pricesByTicker = useMemo(
    () => new Map(uniqueTickers.map((ticker, i) => [ticker, priceQueries[i]?.data ?? []])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uniqueTickers, priceQueries],
  );

  // ── Step 4: FIFO engine — only reruns when transactions change ───────────
  const { dailyHoldings, dailyCostBasis } = useMemo(
    () => runFifoEngine(transactions),
    [transactions],
  );

  // Ordered date range is the insertion-order key set of dailyHoldings
  const dateRange = useMemo(() => [...dailyHoldings.keys()], [dailyHoldings]);

  // ── Step 5: price matrix with carry-forward ──────────────────────────────
  const priceMatrix: PriceMatrix = useMemo(
    () => buildPriceMatrix(pricesByTicker, dateRange),
    [pricesByTicker, dateRange],
  );

  // ── Step 6: final value series — deferred until all prices are ready ──────
  const data: PortfolioDataPoint[] = useMemo(() => {
    if (isLoadingTransactions || isLoadingPrices) return [];
    return computePortfolioValue(dailyHoldings, priceMatrix, dailyCostBasis);
  }, [dailyHoldings, priceMatrix, dailyCostBasis, isLoadingTransactions, isLoadingPrices]);

  return {
    data,
    isLoading: isLoadingTransactions || isLoadingPrices,
    isError: isErrorTransactions || isErrorPrices,
    error: (transactionsError as Error | null) ?? pricesError,
  };
}
