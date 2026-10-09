import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { backend } from '../api/backend';
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
import {
  resolveTradingSession,
  type SessionMarket,
} from '../services/tradingSession';
import {
  FX_USD_TICKERS,
  currenciesToConvert,
  fxRateFor,
  sumCostBasis,
  type FxRates,
} from '../services/fx';
import { resolveQuotePrice, type QuoteResult } from '../utils/resolveQuotePrice';
const INTRADAY_STALE_TIME_MS = 60 * 1000;

const fetchPerformanceTransactions = async (portfolioId: string): Promise<Transaction[]> => {
  const positions = await backend.listPositions(
    portfolioId === ALL_PORTFOLIOS_ID ? undefined : portfolioId,
  );

  return positions.filter(
    (pos) => pos.status === PositionStatus.Buy || pos.status === PositionStatus.Sell,
  );
};

export type UsePortfolioIntradayPerformanceResult = {
  data: IntradayPortfolioPoint[];
  sessionStart: number | undefined;
  sessionEnd: number | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

function sessionMarketForFilter(
  filter: CompositionFilter,
  transactions: Transaction[],
): SessionMarket {
  if (filter === 'stock' || filter === 'etf') return 'us';
  if (filter === 'bvb') return 'bvb';
  if (filter === 'crypto') return 'crypto';

  const hasUsdStock = transactions.some(
    (tx) =>
      (tx.transaction_type === TransactionType.Stock || tx.transaction_type === TransactionType.Etf) &&
      tx.currency !== Currency.RON,
  );
  if (hasUsdStock) return 'us';
  if (transactions.some((tx) => tx.currency === Currency.RON)) return 'bvb';
  return 'crypto';
}

/**
 * 1D portfolio series from Yahoo 5m bars × latest FIFO holdings.
 * Window is the current trading session (open → now), not a rolling wall-clock range.
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
          tx.currency !== Currency.RON,
      );
    }
    if (filter === 'etf') {
      return rawTransactions.filter(
        (tx) =>
          tx.transaction_type === TransactionType.Etf &&
          tx.currency !== Currency.RON,
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

  /** Non-USD currencies held in this view that must be converted to USD. */
  const convertCurrencies = useMemo(
    () => currenciesToConvert(tickerCurrency.values(), filter === 'bvb'),
    [filter, tickerCurrency],
  );
  const needsFxConversion = convertCurrencies.length > 0;
  const fxTickers = useMemo(
    () => convertCurrencies.map((currency) => FX_USD_TICKERS[currency]),
    [convertCurrencies],
  );

  const { dailyHoldings, dailyCostBasis, dailyTickerCost } = useMemo(
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

  const historyTickers = useMemo(
    () => [...new Set([...heldTickers, ...fxTickers])].sort(),
    [heldTickers, fxTickers],
  );

  const {
    data: historyByTicker,
    isLoading: isLoadingPrices,
    isError: isErrorPrices,
    error: pricesQueryError,
  } = useQuery({
    queryKey: ['stock-intraday', 'batch', '5m', 'prepost', historyTickers] as const,
    queryFn: () => fetchStockIntradayHistories(historyTickers, '5m'),
    enabled: enabled && historyTickers.length > 0,
    staleTime: INTRADAY_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });

  const quoteTickers = useMemo(
    () => [...heldTickers, ...fxTickers],
    [heldTickers, fxTickers],
  );

  const needsQuotes = heldTickers.length > 0 || needsFxConversion;

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

  /** Live currency→USD spot rates. */
  const liveFxRates: FxRates = useMemo(() => {
    const rates: FxRates = new Map();
    for (const currency of convertCurrencies) {
      rates.set(currency, resolveQuotePrice(quoteMap.get(FX_USD_TICKERS[currency])).price);
    }
    return rates;
  }, [convertCurrencies, quoteMap]);

  const isFirstDayBook = dailyHoldings.size === 1;

  const hasFx = convertCurrencies.every((currency) => (liveFxRates.get(currency) ?? 0) > 0);

  const waitingForFx = needsFxConversion && (isLoadingPrices || isLoadingQuotes) && !hasFx;
  const waitingForQuotes = needsQuotes && !quotes && isLoadingQuotes;
  const waitingForHistory = historyTickers.length > 0 && isLoadingPrices && !isFirstDayBook;

  const sessionMarket = useMemo(
    () => sessionMarketForFilter(filter, transactions),
    [filter, transactions],
  );

  const { data, sessionStart, sessionEnd } = useMemo(() => {
    const empty = { data: [] as IntradayPortfolioPoint[], sessionStart: undefined, sessionEnd: undefined };
    if (
      !enabled ||
      !latestHoldings ||
      isLoadingTransactions ||
      waitingForHistory ||
      waitingForQuotes ||
      waitingForFx ||
      !hasFx
    ) {
      return empty;
    }

    const pricesByTicker = new Map(
      heldTickers.map((ticker) => [ticker, historyByTicker?.get(ticker) ?? []]),
    );

    let latestBarT: number | undefined;
    for (const bars of pricesByTicker.values()) {
      const last = bars[bars.length - 1];
      if (last && last.t > (latestBarT ?? 0)) latestBarT = last.t;
    }

    const now = Date.now();
    const session = resolveTradingSession(sessionMarket, now, latestBarT);
    const windowEnd = Math.min(now, session.end);

    const fxRates: FxRates = new Map(liveFxRates);
    for (const currency of convertCurrencies) {
      if ((fxRates.get(currency) ?? 0) > 0) continue;
      const fxBars = historyByTicker?.get(FX_USD_TICKERS[currency]) ?? [];
      const lastFx = fxBars[fxBars.length - 1];
      if (lastFx && lastFx.c > 0) fxRates.set(currency, lastFx.c);
    }

    const costBasis = sumCostBasis(
      dailyCostBasis.get(latestHoldings.date),
      fxRates,
      convertCurrencies,
    );

    const seedPrices = new Map<string, number>();
    for (const ticker of heldTickers) {
      const livePrice = resolveQuotePrice(quoteMap.get(ticker)).price;
      if (livePrice > 0) seedPrices.set(ticker, livePrice);
    }

    const series = computeIntradayPortfolioValue(
      latestHoldings.holdings,
      costBasis,
      pricesByTicker,
      {
        tickerCurrency,
        fxRates,
        convertCurrencies,
        windowStart: session.start,
        windowEnd,
        seedPrices,
        tickerCost: dailyTickerCost.get(latestHoldings.date),
      },
    );

    const withSession = {
      data: series,
      sessionStart: session.start,
      sessionEnd: session.end,
    };

    if (series.length === 0 || heldTickers.length === 0 || !quotes) return withSession;

    let liveValue = 0;
    let usedLivePrice = false;
    for (const [ticker, shares] of latestHoldings.holdings) {
      const livePrice = resolveQuotePrice(quoteMap.get(ticker)).price;
      const currency = tickerCurrency.get(ticker);
      const rate = fxRateFor(currency, fxRates, convertCurrencies);
      const tickerFx = rate > 0 ? rate : 1;

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

    if (!usedLivePrice || now > session.end) return withSession;

    const patched = [...series];
    const last = patched[patched.length - 1];
    patched[patched.length - 1] = {
      ...last,
      t: windowEnd,
      value: liveValue,
      costBasis,
    };
    return { ...withSession, data: patched };
  }, [
    enabled,
    latestHoldings,
    isLoadingTransactions,
    waitingForHistory,
    waitingForQuotes,
    waitingForFx,
    hasFx,
    heldTickers,
    historyByTicker,
    dailyCostBasis,
    dailyTickerCost,
    convertCurrencies,
    liveFxRates,
    tickerCurrency,
    quotes,
    quoteMap,
    sessionMarket,
  ]);

  return {
    data,
    sessionStart,
    sessionEnd,
    isLoading:
      enabled &&
      (isLoadingTransactions ||
        waitingForHistory ||
        waitingForQuotes ||
        waitingForFx),
    isError: isErrorTransactions || isErrorPrices,
    error: (transactionsError as Error | null) ?? (pricesQueryError as Error | null),
  };
}
