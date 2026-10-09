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
import {
  FX_USD_TICKERS,
  buildFxSeries,
  currenciesToConvert,
  fxRateFor,
  fxRatesOnDate,
  sumCostBasis,
  type FxRates,
  type FxSeriesByCurrency,
} from '../services/fx';
import { resolveQuotePrice, type QuoteResult } from '../utils/resolveQuotePrice';

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
          tx.currency !== Currency.RON,
      );
    }
    if (filter === 'etf') {
      return scoped.filter(
        (tx) =>
          tx.transaction_type === TransactionType.Etf &&
          tx.currency !== Currency.RON,
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

  const uniqueTickers = useMemo(
    () => [...new Set(transactions.map((tx) => tx.ticker_symbol))],
    [transactions],
  );

  const historyTickers = useMemo(() => {
    return [...new Set([...uniqueTickers, ...fxTickers])].sort();
  }, [uniqueTickers, fxTickers]);

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
  const waitingForFxHistory = needsFxConversion && isLoadingPrices;

  const pricesByTicker = useMemo(() => {
    const map = new Map<string, StockBarWithDate[]>();
    for (const ticker of uniqueTickers) {
      map.set(ticker, historyByTicker?.get(ticker) ?? []);
    }
    return map;
  }, [uniqueTickers, historyByTicker]);

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
    () => [...heldTickers, ...fxTickers],
    [heldTickers, fxTickers],
  );

  const needsQuotes = heldTickers.length > 0 || needsFxConversion;

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

  /** Live currency→USD spot rates. */
  const liveFxRates: FxRates = useMemo(() => {
    const rates: FxRates = new Map();
    for (const currency of convertCurrencies) {
      rates.set(currency, resolveQuotePrice(quoteMap.get(FX_USD_TICKERS[currency])).price);
    }
    return rates;
  }, [convertCurrencies, quoteMap]);

  /** Per-day currency→USD; live spot overrides the latest calendar day. */
  const fxByDate: FxSeriesByCurrency | null = useMemo(() => {
    if (!needsFxConversion) return null;
    if (waitingForFxHistory) return null;

    const series: FxSeriesByCurrency = new Map();
    for (const currency of convertCurrencies) {
      const live = liveFxRates.get(currency) ?? 0;
      series.set(
        currency,
        buildFxSeries(
          historyByTicker?.get(FX_USD_TICKERS[currency]) ?? [],
          dateRange,
          live > 0 ? live : undefined,
        ),
      );
    }
    return series;
  }, [
    needsFxConversion,
    waitingForFxHistory,
    convertCurrencies,
    historyByTicker,
    dateRange,
    liveFxRates,
  ]);

  /** Every converted currency has at least one usable rate. */
  const hasFx = convertCurrencies.every(
    (currency) =>
      (liveFxRates.get(currency) ?? 0) > 0 ||
      [...(fxByDate?.get(currency)?.values() ?? [])].some((rate) => rate > 0),
  );

  /** Still fetching the FX inputs — not a permanent missing-rate state. */
  const waitingForFx =
    needsFxConversion && (waitingForFxHistory || waitingForQuotes);

  const realizedGains: RealizedGainPoint[] = useMemo(() => {
    if (isLoadingTransactions || waitingForFx || !hasFx) return [];

    return rawRealizedGains.map((event) => {
      const fx = fxRateFor(
        event.currency,
        fxRatesOnDate(fxByDate, event.date, liveFxRates, convertCurrencies),
        convertCurrencies,
      );
      return {
        date: event.date,
        gain: event.gain * fx,
        cost: event.cost * fx,
      };
    });
  }, [
    rawRealizedGains,
    isLoadingTransactions,
    waitingForFx,
    hasFx,
    convertCurrencies,
    fxByDate,
    liveFxRates,
  ]);

  const cashFlows: CashFlowPoint[] = useMemo(() => {
    if (isLoadingTransactions || waitingForFx || !hasFx) return [];

    return transactions.map((tx) => {
      const fx = fxRateFor(
        tx.currency,
        fxRatesOnDate(fxByDate, tx.buy_date, liveFxRates, convertCurrencies),
        convertCurrencies,
      );
      const notional = tx.quantity * tx.price * fx;
      return {
        date: tx.buy_date,
        amount: tx.status === PositionStatus.Buy ? -notional : notional,
      };
    });
  }, [
    transactions,
    isLoadingTransactions,
    waitingForFx,
    hasFx,
    convertCurrencies,
    fxByDate,
    liveFxRates,
  ]);

  const data: PortfolioDataPoint[] = useMemo(() => {
    if (
      isLoadingTransactions ||
      waitingForHistory ||
      waitingForQuotes ||
      waitingForFx ||
      !hasFx
    ) {
      return [];
    }

    const series = computePortfolioValue(dailyHoldings, priceMatrix, dailyCostBasis, {
      tickerCurrency,
      fxByDate: fxByDate ?? undefined,
      fxRates: liveFxRates,
      convertCurrencies,
      dailyTickerCost,
    });

    if (series.length === 0 || !latestHoldings) return series;
    if (heldTickers.length > 0 && !quotes) return series;

    let liveValue = 0;
    let usedLivePrice = false;
    const latestFx = fxRatesOnDate(
      fxByDate,
      latestHoldings.date,
      liveFxRates,
      convertCurrencies,
    );

    for (const [ticker, shares] of latestHoldings.holdings) {
      const livePrice = resolveQuotePrice(quoteMap.get(ticker)).price;
      const currency = tickerCurrency.get(ticker);
      const fx = fxRateFor(currency, latestFx, convertCurrencies);

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
      costBasis: needsFxConversion
        ? sumCostBasis(dailyCostBasis.get(latestHoldings.date), latestFx, convertCurrencies)
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
    waitingForFx,
    hasFx,
    latestHoldings,
    quotes,
    heldTickers.length,
    tickerCurrency,
    needsFxConversion,
    convertCurrencies,
    fxByDate,
    liveFxRates,
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
      waitingForFx,
    isError: isErrorTransactions || isErrorPrices,
    error: (transactionsError as Error | null) ?? pricesError,
  };
}
