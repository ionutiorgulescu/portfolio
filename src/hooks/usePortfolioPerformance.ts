import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { backend } from '../api/backend';
import { supabase } from '../api/supabase';
import { Currency, PositionStatus, TransactionType } from '../types/positions';
import type {
  CashFlowPoint,
  PortfolioDataPoint,
  PriceMatrix,
  RealizedGainPoint,
  Transaction,
  UsePortfolioPerformanceResult,
} from '../types/performance';
import type { CompositionFilter } from '../components/FilterControl';
import { ALL_PORTFOLIOS_ID } from '../contexts/PortfolioContext';
import { fetchStockHistories, type StockBarWithDate } from './useStockData';
import { runFifoEngine } from '../services/fifoEngine';
import { buildPriceMatrix, type PriceSeed } from '../services/priceMatrix';
import { computePortfolioValue } from '../services/portfolioValue';
import { buildRonUsdSeries, ronUsdOnDate } from '../services/ronUsd';
import { resolveQuotePrice, type QuoteResult } from '../utils/resolveQuotePrice';

const RON_USD_TICKER = 'RONUSD=X';

const fetchPerformanceTransactions = async (portfolioId: string): Promise<Transaction[]> => {
  const positions = await backend.listPositions(
    portfolioId === ALL_PORTFOLIOS_ID ? undefined : portfolioId,
  );

  return positions.filter(
    (pos) => pos.status === PositionStatus.Buy || pos.status === PositionStatus.Sell,
  );
};

export function usePortfolioPerformance(
  filter: CompositionFilter = 'all',
  portfolioId: string = '',
  includeCrypto = true,
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
    const scoped = includeCrypto
      ? rawTransactions
      : rawTransactions.filter((tx) => tx.transaction_type !== TransactionType.Crypto);

    if (filter === 'all') return scoped;
    if (filter === 'stock') {
      return scoped.filter(
        (tx) =>
          tx.transaction_type === TransactionType.Stock &&
          tx.currency === Currency.USD,
      );
    }
    if (filter === 'crypto') {
      return scoped.filter((tx) => tx.transaction_type === TransactionType.Crypto);
    }
    if (filter === 'bvb') return scoped.filter((tx) => tx.currency === Currency.RON);
    return scoped;
  }, [rawTransactions, filter, includeCrypto]);

  /** Years available for period chips: first buy year → current year (newest first). */
  const years = useMemo(() => {
    let firstYear: number | null = null;
    for (const tx of transactions) {
      if (tx.status !== PositionStatus.Buy) continue;
      const year = Number(tx.buy_date.slice(0, 4));
      if (!Number.isFinite(year)) continue;
      if (firstYear === null || year < firstYear) firstYear = year;
    }
    if (firstYear === null) return [];

    const currentYear = new Date().getUTCFullYear();
    const start = Math.min(firstYear, currentYear);
    const end = Math.max(firstYear, currentYear);
    const result: number[] = [];
    for (let year = end; year >= start; year -= 1) {
      result.push(year);
    }
    return result;
  }, [transactions]);

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

  const uniqueTickers = useMemo(
    () => [...new Set(transactions.map((tx) => tx.ticker_symbol))],
    [transactions],
  );

  const historyTickers = useMemo(() => {
    const tickers = needsRonConversion
      ? [...uniqueTickers, RON_USD_TICKER]
      : uniqueTickers;
    return [...new Set(tickers)].sort();
  }, [uniqueTickers, needsRonConversion]);

  const {
    data: historyByTicker,
    isLoading: isLoadingPrices,
    isError: isErrorPrices,
    error: pricesQueryError,
  } = useQuery({
    queryKey: ['stock-history', 'batch', historyTickers] as const,
    queryFn: () => fetchStockHistories(historyTickers),
    enabled: historyTickers.length > 0,
    staleTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const pricesError = (pricesQueryError as Error | null) ?? null;
  const waitingForRonUsdHistory =
    needsRonConversion && isLoadingPrices && historyTickers.includes(RON_USD_TICKER);

  const pricesByTicker = useMemo(() => {
    const map = new Map<string, StockBarWithDate[]>();
    for (const ticker of uniqueTickers) {
      map.set(ticker, historyByTicker?.get(ticker) ?? []);
    }
    return map;
  }, [uniqueTickers, historyByTicker]);

  const ronUsdHistory = historyByTicker?.get(RON_USD_TICKER) ?? [];

  const {
    dailyHoldings,
    dailyCostBasis,
    dailyTickerCost,
    realizedGains: rawRealizedGains,
  } = useMemo(() => runFifoEngine(transactions), [transactions]);

  const isFirstDayBook = dailyHoldings.size === 1;
  const waitingForHistory = historyTickers.length > 0 && isLoadingPrices && !isFirstDayBook;

  const dateRange = useMemo(() => [...dailyHoldings.keys()], [dailyHoldings]);

  /** Buy prices fill valuation gaps before a ticker's first market bar. */
  const buyPriceSeeds = useMemo(() => {
    const seeds = new Map<string, PriceSeed[]>();
    for (const tx of transactions) {
      if (tx.status !== PositionStatus.Buy) continue;
      const list = seeds.get(tx.ticker_symbol) ?? [];
      list.push({ date: tx.buy_date, price: tx.price });
      seeds.set(tx.ticker_symbol, list);
    }
    return seeds;
  }, [transactions]);

  const priceMatrix: PriceMatrix = useMemo(
    () => buildPriceMatrix(pricesByTicker, dateRange, buyPriceSeeds),
    [pricesByTicker, dateRange, buyPriceSeeds],
  );

  const latestHoldings = useMemo(() => {
    if (dailyHoldings.size === 0) return null;
    const dates = [...dailyHoldings.keys()];
    const date = dates[dates.length - 1];
    return { date, holdings: dailyHoldings.get(date)! };
  }, [dailyHoldings]);

  const heldTickers = useMemo(
    () => (latestHoldings ? [...latestHoldings.holdings.keys()] : []),
    [latestHoldings],
  );

  const quoteTickers = useMemo(
    () => (needsRonConversion ? [...heldTickers, RON_USD_TICKER] : heldTickers),
    [heldTickers, needsRonConversion],
  );

  const needsQuotes = heldTickers.length > 0 || needsRonConversion;

  const {
    data: quotes,
    isLoading: isLoadingQuotes,
  } = useQuery<QuoteResult[]>({
    queryKey: ['performanceQuotes', filter, quoteTickers],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-quotas', {
        body: { tickers: quoteTickers },
      });
      if (error) throw error;
      return data as QuoteResult[];
    },
    enabled: needsQuotes && !isLoadingTransactions && !isLoadingPrices,
    staleTime: 5 * 60 * 1000,
  });

  const waitingForQuotes = needsQuotes && !quotes && isLoadingQuotes;

  const quoteMap = useMemo(
    () => new Map((quotes ?? []).map((q) => [q.symbol, q])),
    [quotes],
  );

  const liveRonToUsd = useMemo(() => {
    if (!needsRonConversion) return 0;
    return resolveQuotePrice(quoteMap.get(RON_USD_TICKER)).price;
  }, [needsRonConversion, quoteMap]);

  /** Per-day RON→USD; live spot overrides the latest calendar day. */
  const ronToUsdByDate = useMemo(() => {
    if (!needsRonConversion) return null;
    if (waitingForRonUsdHistory) return null;

    return buildRonUsdSeries(
      ronUsdHistory,
      dateRange,
      liveRonToUsd > 0 ? liveRonToUsd : undefined,
    );
  }, [
    needsRonConversion,
    waitingForRonUsdHistory,
    ronUsdHistory,
    dateRange,
    liveRonToUsd,
  ]);

  const hasRonFx =
    !needsRonConversion ||
    liveRonToUsd > 0 ||
    (ronToUsdByDate != null &&
      [...ronToUsdByDate.values()].some((rate) => rate > 0));

  /** Still fetching the FX inputs — not a permanent missing-rate state. */
  const waitingForRonFx =
    needsRonConversion && (waitingForRonUsdHistory || waitingForQuotes);

  const realizedGains: RealizedGainPoint[] = useMemo(() => {
    if (isLoadingTransactions || waitingForRonFx || !hasRonFx) return [];

    return rawRealizedGains.map((event) => {
      const fx =
        needsRonConversion && event.currency === Currency.RON
          ? ronUsdOnDate(ronToUsdByDate, event.date, liveRonToUsd)
          : 1;
      return {
        date: event.date,
        gain: event.gain * fx,
        cost: event.cost * fx,
      };
    });
  }, [
    rawRealizedGains,
    isLoadingTransactions,
    waitingForRonFx,
    hasRonFx,
    needsRonConversion,
    ronToUsdByDate,
    liveRonToUsd,
  ]);

  const cashFlows: CashFlowPoint[] = useMemo(() => {
    if (isLoadingTransactions || waitingForRonFx || !hasRonFx) return [];

    return transactions.map((tx) => {
      const fx =
        needsRonConversion && tx.currency === Currency.RON
          ? ronUsdOnDate(ronToUsdByDate, tx.buy_date, liveRonToUsd)
          : 1;
      const notional = tx.quantity * tx.price * fx;
      return {
        date: tx.buy_date,
        amount: tx.status === PositionStatus.Buy ? -notional : notional,
      };
    });
  }, [
    transactions,
    isLoadingTransactions,
    waitingForRonFx,
    hasRonFx,
    needsRonConversion,
    ronToUsdByDate,
    liveRonToUsd,
  ]);

  const data: PortfolioDataPoint[] = useMemo(() => {
    if (
      isLoadingTransactions ||
      waitingForHistory ||
      waitingForQuotes ||
      waitingForRonFx ||
      !hasRonFx
    ) {
      return [];
    }

    const series = computePortfolioValue(dailyHoldings, priceMatrix, dailyCostBasis, {
      tickerCurrency,
      ronToUsdByDate: ronToUsdByDate ?? undefined,
      ronToUsd: liveRonToUsd,
      convertRon: needsRonConversion,
      dailyTickerCost,
    });

    if (series.length === 0 || !latestHoldings) return series;
    if (heldTickers.length > 0 && !quotes) return series;

    let liveValue = 0;
    let usedLivePrice = false;
    const latestFx = ronUsdOnDate(
      ronToUsdByDate,
      latestHoldings.date,
      liveRonToUsd,
    );

    for (const [ticker, shares] of latestHoldings.holdings) {
      const livePrice = resolveQuotePrice(quoteMap.get(ticker)).price;
      const currency = tickerCurrency.get(ticker);
      const fx = needsRonConversion && currency === Currency.RON ? latestFx : 1;

      if (livePrice > 0) {
        liveValue += shares * livePrice * fx;
        usedLivePrice = true;
        continue;
      }

      const historical = priceMatrix.get(ticker)?.get(latestHoldings.date);
      if (historical !== undefined) {
        liveValue += shares * historical * fx;
      }
    }

    if (!usedLivePrice) return series;

    const patched = [...series];
    const last = patched[patched.length - 1];
    patched[patched.length - 1] = {
      ...last,
      value: liveValue,
      // Keep invested capital on the same FX as the live mark.
      costBasis: needsRonConversion
        ? (dailyCostBasis.get(latestHoldings.date)?.usd ?? 0) +
          (dailyCostBasis.get(latestHoldings.date)?.ron ?? 0) * latestFx
        : last.costBasis,
    };
    return patched;
  }, [
    dailyHoldings,
    priceMatrix,
    dailyCostBasis,
    dailyTickerCost,
    isLoadingTransactions,
    waitingForHistory,
    waitingForQuotes,
    waitingForRonFx,
    hasRonFx,
    latestHoldings,
    quotes,
    heldTickers.length,
    tickerCurrency,
    needsRonConversion,
    ronToUsdByDate,
    liveRonToUsd,
    quoteMap,
  ]);

  return {
    data,
    realizedGains,
    cashFlows,
    years,
    isLoading:
      isLoadingTransactions ||
      waitingForHistory ||
      waitingForQuotes ||
      waitingForRonFx,
    isError: isErrorTransactions || isErrorPrices,
    error: (transactionsError as Error | null) ?? pricesError,
  };
}
