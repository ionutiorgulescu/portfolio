import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import { Currency, PositionStatus, TransactionType } from '../types/positions';
import type {
  PortfolioDataPoint,
  PriceMatrix,
  Transaction,
  UsePortfolioPerformanceResult,
} from '../types/performance';
import type { CompositionFilter } from '../components/FilterControl';
import { ALL_PORTFOLIOS_ID } from '../contexts/PortfolioContext';
import { fetchStockHistory } from './useStockData';
import { runFifoEngine } from '../services/fifoEngine';
import { buildPriceMatrix } from '../services/priceMatrix';
import { computePortfolioValue } from '../services/portfolioValue';

const fetchPerformanceTransactions = async (portfolioId: string): Promise<Transaction[]> => {
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

  let query = supabase
    .from('positions')
    .select('*')
    .eq('user_id', user.id)
    .in('status', [PositionStatus.Buy, PositionStatus.Sell])
    .order('buy_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (portfolioId !== ALL_PORTFOLIOS_ID) {
    query = query.eq('portfolio_id', portfolioId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []) as Transaction[];
};

export function usePortfolioPerformance(
  filter: CompositionFilter = 'all',
  portfolioId: string = '',
): UsePortfolioPerformanceResult {
  const {
    data: rawTransactions = [],
    isLoading: isLoadingTransactions,
    isError: isErrorTransactions,
    error: transactionsError,
  } = useQuery({
    queryKey: ['portfolio-performance-transactions', portfolioId],
    queryFn: () => fetchPerformanceTransactions(portfolioId),
    enabled: !!portfolioId,
  });

  const transactions = useMemo(() => {
    if (filter === 'all') return rawTransactions;
    if (filter === 'stock') return rawTransactions.filter(tx => tx.transaction_type === TransactionType.Stock && tx.currency === Currency.USD);
    if (filter === 'crypto') return rawTransactions.filter(tx => tx.transaction_type === TransactionType.Crypto);
    if (filter === 'bvb') return rawTransactions.filter(tx => tx.currency === Currency.RON);
    return rawTransactions;
  }, [rawTransactions, filter]);

  const uniqueTickers = useMemo(
    () => [...new Set(transactions.map((tx) => tx.ticker_symbol))],
    [transactions],
  );

  const priceQueries = useQueries({
    queries: uniqueTickers.map((ticker) => ({
      queryKey: ['stock-history', ticker] as const,
      queryFn: () => fetchStockHistory(ticker),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoadingPrices = priceQueries.some((q) => q.isLoading);
  const isErrorPrices = priceQueries.some((q) => q.isError);
  const pricesError = (priceQueries.find((q) => q.error)?.error ?? null) as Error | null;

  const pricesByTicker = useMemo(
    () => new Map(uniqueTickers.map((ticker, i) => [ticker, priceQueries[i]?.data ?? []])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uniqueTickers, priceQueries],
  );

  const { dailyHoldings, dailyCostBasis } = useMemo(
    () => runFifoEngine(transactions),
    [transactions],
  );

  const dateRange = useMemo(() => [...dailyHoldings.keys()], [dailyHoldings]);

  const priceMatrix: PriceMatrix = useMemo(
    () => buildPriceMatrix(pricesByTicker, dateRange),
    [pricesByTicker, dateRange],
  );

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