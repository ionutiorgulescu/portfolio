import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import { Currency, PositionStatus, TransactionType } from '../types/positions';
import type { Transaction } from '../types/performance';
import type { CompositionFilter } from '../components/FilterControl';
import { ALL_PORTFOLIOS_ID } from '../contexts/PortfolioContext';
import { fetchStockIntradayHistories } from './useStockData';
import { runFifoEngine } from '../services/fifoEngine';
import {
  computeIntradayPortfolioValue,
  type IntradayPortfolioPoint,
} from '../services/intradayPortfolioValue';
import { resolveQuotePrice, type QuoteResult } from '../utils/resolveQuotePrice';

const RON_USD_TICKER = 'RONUSD=X';
const INTRADAY_STALE_TIME_MS = 60 * 1000;

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

export type UsePortfolioIntradayPerformanceResult = {
  data: IntradayPortfolioPoint[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

/**
 * 1D portfolio series from Yahoo 5m bars × latest FIFO holdings.
 * Uses a rolling ~24h window (overnight flat between sessions is expected).
 */
export function usePortfolioIntradayPerformance(
  filter: CompositionFilter = 'all',
  portfolioId: string = '',
  enabled = true,
): UsePortfolioIntradayPerformanceResult {
  const {
    data: rawTransactions = [],
    isLoading: isLoadingTransactions,
    isError: isErrorTransactions,
    error: transactionsError,
  } = useQuery({
    queryKey: ['portfolio-performance-transactions', portfolioId],
    queryFn: () => fetchPerformanceTransactions(portfolioId),
    enabled: enabled && !!portfolioId,
  });

  const transactions = useMemo(() => {
    if (filter === 'all') return rawTransactions;
    if (filter === 'stock') {
      return rawTransactions.filter(
        (tx) =>
          tx.transaction_type === TransactionType.Stock &&
          tx.currency === Currency.USD,
      );
    }
    if (filter === 'crypto') {
      return rawTransactions.filter((tx) => tx.transaction_type === TransactionType.Crypto);
    }
    if (filter === 'bvb') return rawTransactions.filter((tx) => tx.currency === Currency.RON);
    return rawTransactions;
  }, [rawTransactions, filter]);

  const tickerCurrency = useMemo(() => {
    const map = new Map<string, Currency>();
    for (const tx of transactions) {
      if (!map.has(tx.ticker_symbol)) {
        map.set(tx.ticker_symbol, tx.currency as Currency);
      }
    }
    return map;
  }, [transactions]);

  const needsRonConversion = useMemo(
    () => filter !== 'bvb' && [...tickerCurrency.values()].some((c) => c === Currency.RON),
    [filter, tickerCurrency],
  );

  const { dailyHoldings, dailyCostBasis } = useMemo(
    () => runFifoEngine(transactions),
    [transactions],
  );

  const latestHoldings = useMemo(() => {
    if (dailyHoldings.size === 0) return null;
    const dates = [...dailyHoldings.keys()];
    const date = dates[dates.length - 1];
    return { date, holdings: dailyHoldings.get(date)! };
  }, [dailyHoldings]);

  const heldTickers = useMemo(
    () => (latestHoldings ? [...latestHoldings.holdings.keys()].sort() : []),
    [latestHoldings],
  );

  const historyTickers = useMemo(() => {
    const tickers = needsRonConversion ? [...heldTickers, RON_USD_TICKER] : heldTickers;
    return [...new Set(tickers)].sort();
  }, [heldTickers, needsRonConversion]);

  const {
    data: historyByTicker,
    isLoading: isLoadingPrices,
    isError: isErrorPrices,
    error: pricesQueryError,
  } = useQuery({
    queryKey: ['stock-intraday', 'batch', '5m', historyTickers] as const,
    queryFn: () => fetchStockIntradayHistories(historyTickers, '5m'),
    enabled: enabled && historyTickers.length > 0,
    staleTime: INTRADAY_STALE_TIME_MS,
  });

  const quoteTickers = useMemo(
    () => (needsRonConversion ? [...heldTickers, RON_USD_TICKER] : heldTickers),
    [heldTickers, needsRonConversion],
  );

  const needsQuotes = heldTickers.length > 0 || needsRonConversion;

  const { data: quotes, isLoading: isLoadingQuotes } = useQuery<QuoteResult[]>({
    queryKey: ['performanceQuotes', filter, quoteTickers],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-quotas', {
        body: { tickers: quoteTickers },
      });
      if (error) throw error;
      return data as QuoteResult[];
    },
    enabled: enabled && needsQuotes && !isLoadingTransactions && !isLoadingPrices,
    staleTime: 5 * 60 * 1000,
  });

  const quoteMap = useMemo(
    () => new Map((quotes ?? []).map((q) => [q.symbol, q])),
    [quotes],
  );

  const liveRonToUsd = useMemo(() => {
    if (!needsRonConversion) return 0;
    return resolveQuotePrice(quoteMap.get(RON_USD_TICKER)).price;
  }, [needsRonConversion, quoteMap]);

  const waitingForRonFx =
    needsRonConversion &&
    (isLoadingPrices || isLoadingQuotes) &&
    !(liveRonToUsd > 0);

  const hasRonFx = !needsRonConversion || liveRonToUsd > 0;

  const data = useMemo(() => {
    if (
      !enabled ||
      !latestHoldings ||
      isLoadingTransactions ||
      isLoadingPrices ||
      waitingForRonFx ||
      !hasRonFx
    ) {
      return [];
    }

    const pricesByTicker = new Map(
      heldTickers.map((ticker) => [ticker, historyByTicker?.get(ticker) ?? []]),
    );

    let ronToUsd = liveRonToUsd;
    if (needsRonConversion && !(ronToUsd > 0)) {
      const fxBars = historyByTicker?.get(RON_USD_TICKER) ?? [];
      const lastFx = fxBars[fxBars.length - 1];
      if (lastFx && lastFx.c > 0) ronToUsd = lastFx.c;
    }

    const parts = dailyCostBasis.get(latestHoldings.date) ?? { usd: 0, ron: 0 };
    const costBasis = needsRonConversion
      ? parts.usd + parts.ron * (ronToUsd > 0 ? ronToUsd : 0)
      : parts.usd + parts.ron;

    const series = computeIntradayPortfolioValue(
      latestHoldings.holdings,
      costBasis,
      pricesByTicker,
      {
        tickerCurrency,
        ronToUsd,
        convertRon: needsRonConversion,
      },
    );

    if (series.length === 0 || heldTickers.length === 0 || !quotes) return series;

    let liveValue = 0;
    let usedLivePrice = false;
    const fx = ronToUsd > 0 ? ronToUsd : 1;

    for (const [ticker, shares] of latestHoldings.holdings) {
      const livePrice = resolveQuotePrice(quoteMap.get(ticker)).price;
      const currency = tickerCurrency.get(ticker);
      const tickerFx = needsRonConversion && currency === Currency.RON ? fx : 1;

      if (livePrice > 0) {
        liveValue += shares * livePrice * tickerFx;
        usedLivePrice = true;
        continue;
      }

      const bars = pricesByTicker.get(ticker) ?? [];
      const last = bars[bars.length - 1];
      if (last && last.c > 0) {
        liveValue += shares * last.c * tickerFx;
      }
    }

    if (!usedLivePrice) return series;

    const patched = [...series];
    const last = patched[patched.length - 1];
    const now = Date.now();
    patched[patched.length - 1] = {
      ...last,
      t: Math.max(last.t, now),
      value: liveValue,
      costBasis,
    };
    return patched;
  }, [
    enabled,
    latestHoldings,
    isLoadingTransactions,
    isLoadingPrices,
    waitingForRonFx,
    hasRonFx,
    heldTickers,
    historyByTicker,
    dailyCostBasis,
    needsRonConversion,
    liveRonToUsd,
    tickerCurrency,
    quotes,
    quoteMap,
  ]);

  return {
    data,
    isLoading:
      enabled &&
      (isLoadingTransactions ||
        (historyTickers.length > 0 && isLoadingPrices) ||
        waitingForRonFx),
    isError: isErrorTransactions || isErrorPrices,
    error: (transactionsError as Error | null) ?? (pricesQueryError as Error | null),
  };
}
