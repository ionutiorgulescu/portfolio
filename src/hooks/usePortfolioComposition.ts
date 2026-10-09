import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import { usePositions } from './usePositions';
import { PositionStatus, TransactionType, Currency } from '../types/positions';
import type { CompositionFilter } from '../components/FilterControl';
import { FX_USD_TICKERS, currenciesToConvert, fxRateFor, type FxRates } from '../services/fx';
import {
  resolveQuotePrice,
  type PriceSession,
  type QuoteResult,
} from '../utils/resolveQuotePrice';

export type { PriceSession };

export interface TickerComposition {
  ticker: string;
  transactionType: TransactionType;
  assetName: string;
  quantity: number;
  /** Cost basis in the view's display currency (USD unless BVB). */
  costBasis: number;
  /** Average cost in the listing currency (`currency`). */
  avgCost: number;
  /** Market value in the view's display currency (USD unless BVB). */
  currentValue: number;
  /** Quote in the listing currency (`currency`). */
  currentPrice: number;
  priceSession: PriceSession | null;
  /** % change of PRE/POST price vs regularMarketPrice; null when not in session pricing. */
  sessionChangePercent: number | null;
  /** Regular-hours trading (Yahoo marketState === REGULAR). */
  isMarketOpen: boolean;
  /** Intraday regular-session % change; null when market is closed / extended. */
  dayChangePercent: number | null;
  gainLoss: number;
  weight: number;
  currency: Currency;
}

function buildFifoHoldings(
  positions: ReturnType<typeof usePositions>['data'],
  filter: CompositionFilter
) {
  if (!positions) return new Map<string, {
    quantity: number;
    costBasis: number;
    avgCost: number;
    assetName: string;
    transactionType: TransactionType;
    currency: Currency;
  }>();

  const filtered = filter === 'all'
    ? positions
    : positions.filter(p => {
        if (filter === 'stock') return p.transaction_type === TransactionType.Stock && p.currency !== Currency.RON;
        if (filter === 'crypto') return p.transaction_type === TransactionType.Crypto;
        if (filter === 'bvb') return p.currency === Currency.RON;
        return true;
      });

  const sorted = [...filtered].sort((a, b) => {
    if (a.buy_date !== b.buy_date) return a.buy_date < b.buy_date ? -1 : 1;
    if (a.status === PositionStatus.Buy && b.status === PositionStatus.Sell) return -1;
    if (a.status === PositionStatus.Sell && b.status === PositionStatus.Buy) return 1;
    return 0;
  });

  const lotQueues = new Map<string, Array<{
    quantity: number;
    price: number;
    assetName: string;
    transactionType: TransactionType;
    currency: Currency;
  }>>();

  for (const p of sorted) {
    if (p.status === PositionStatus.Buy) {
      const queue = lotQueues.get(p.ticker_symbol) ?? [];
      queue.push({
        quantity: p.quantity,
        price: p.price,
        assetName: p.asset_name,
        transactionType: p.transaction_type,
        currency: p.currency as Currency,
      });
      lotQueues.set(p.ticker_symbol, queue);
    } else if (p.status === PositionStatus.Sell) {
      const queue = lotQueues.get(p.ticker_symbol) ?? [];
      let remaining = p.quantity;
      while (remaining > 0 && queue.length > 0) {
        const front = queue[0];
        if (front.quantity <= remaining) {
          remaining -= front.quantity;
          queue.shift();
        } else {
          front.quantity -= remaining;
          remaining = 0;
        }
      }
      lotQueues.set(p.ticker_symbol, queue);
    }
  }

  const holdings = new Map<string, {
    quantity: number;
    costBasis: number;
    avgCost: number;
    assetName: string;
    transactionType: TransactionType;
    currency: Currency;
  }>();

  for (const [ticker, queue] of lotQueues.entries()) {
    const quantity = queue.reduce((sum, lot) => sum + lot.quantity, 0);
    const costBasis = queue.reduce((sum, lot) => sum + lot.quantity * lot.price, 0);
    const avgCost = quantity > 1e-10 ? costBasis / quantity : 0;
    const assetName = queue[0]?.assetName ?? ticker;
    const currency = (queue[0]?.currency ?? Currency.USD) as Currency;
    if (quantity > 1e-10) {
      holdings.set(ticker, {
        quantity,
        costBasis,
        avgCost,
        assetName,
        transactionType: queue[0]?.transactionType ?? TransactionType.Stock,
        currency,
      });
    }
  }

  return holdings;
}

export function usePortfolioComposition(filter: CompositionFilter = 'all', portfolioId: string = '') {
  const { data: positions, isLoading: positionsLoading, error: positionsError } = usePositions(portfolioId);

  const holdings = buildFifoHoldings(positions, filter);
  const activeTickers = [...holdings.keys()];

  const convertCurrencies = currenciesToConvert(
    [...holdings.values()].map(h => h.currency),
    filter === 'bvb',
  );
  const tickersToFetch = [
    ...activeTickers,
    ...convertCurrencies.map(currency => FX_USD_TICKERS[currency]),
  ];

  const {
    data: quotes,
    isLoading: quotesLoading,
    error: quotesError,
  } = useQuery<QuoteResult[]>({
    queryKey: ['compositionQuotes', filter, tickersToFetch],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-quotas', {
        body: { tickers: tickersToFetch },
      });
      if (error) throw error;
      return data as QuoteResult[];
    },
    enabled: activeTickers.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const composition: TickerComposition[] = (() => {
    if (!quotes) return [];

    const quoteMap = new Map(quotes.map(q => [q.symbol, q]));
    const fxRates: FxRates = new Map(
      convertCurrencies.map(currency => [
        currency,
        resolveQuotePrice(quoteMap.get(FX_USD_TICKERS[currency])).price,
      ]),
    );

    const totalPortfolioValue = [...holdings.entries()].reduce((sum, [ticker, holding]) => {
      const currentPrice = resolveQuotePrice(quoteMap.get(ticker)).price;
      const fx = fxRateFor(holding.currency, fxRates, convertCurrencies);
      return sum + holding.quantity * currentPrice * fx;
    }, 0);

    return [...holdings.entries()]
      .map(([ticker, holding]) => {
        const {
          price: currentPrice,
          session: priceSession,
          sessionChangePercent,
          isMarketOpen,
          dayChangePercent,
        } = resolveQuotePrice(quoteMap.get(ticker));
        const fx = fxRateFor(holding.currency, fxRates, convertCurrencies);
        const currentValue = holding.quantity * currentPrice * fx;
        const costBasis = holding.costBasis * fx;
        const gainLoss = currentValue - costBasis;
        const weight = totalPortfolioValue > 0 ? (currentValue / totalPortfolioValue) * 100 : 0;

        return {
          ticker,
          transactionType: holding.transactionType,
          assetName: holding.assetName,
          quantity: holding.quantity,
          costBasis,
          avgCost: holding.avgCost,
          currentValue,
          currentPrice,
          priceSession,
          sessionChangePercent,
          isMarketOpen,
          dayChangePercent,
          gainLoss,
          weight,
          currency: holding.currency,
        };
      })
      .sort((a, b) => b.weight - a.weight);
  })();

  return {
    composition,
    tickers: activeTickers,
    loading: positionsLoading || (activeTickers.length > 0 && quotesLoading),
    error: (positionsError ?? quotesError) as Error | null,
  };
}