import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import { usePositions } from './usePositions';
import { PositionStatus, TransactionType, Currency } from '../types/positions';
import type { CompositionFilter } from '../components/FilterControl';

export type PriceSession = 'PRE' | 'POST';

export interface TickerComposition {
  ticker: string;
  transactionType: TransactionType;
  assetName: string;
  quantity: number;
  costBasis: number;
  avgCost: number;
  currentValue: number;
  currentPrice: number;
  priceSession: PriceSession | null;
  /** % change of PRE/POST price vs regularMarketPrice; null when not in session pricing. */
  sessionChangePercent: number | null;
  gainLoss: number;
  weight: number;
  currency: Currency;
}

type QuoteResult = {
  symbol: string;
  regularMarketPrice?: number;
  marketState?: string;
  preMarketPrice?: number | null;
  postMarketPrice?: number | null;
  preMarketChangePercent?: number | null;
  postMarketChangePercent?: number | null;
};

const RON_USD_TICKER = 'RONUSD=X';

function sessionChangeVsRegular(
  sessionPrice: number | null | undefined,
  regular: number,
  apiChangePercent?: number | null,
): number | null {
  if (sessionPrice == null || regular <= 0) return null;
  if (apiChangePercent != null) return apiChangePercent;
  return ((sessionPrice - regular) / regular) * 100;
}

function resolveQuotePrice(quote?: QuoteResult): {
  price: number;
  session: PriceSession | null;
  sessionChangePercent: number | null;
} {
  const regular = quote?.regularMarketPrice ?? 0;
  const marketState = quote?.marketState;

  if (marketState === 'PRE') {
    const sessionPrice = quote?.preMarketPrice;
    return {
      price: sessionPrice ?? regular,
      session: 'PRE',
      sessionChangePercent: sessionChangeVsRegular(
        sessionPrice,
        regular,
        quote?.preMarketChangePercent,
      ),
    };
  }

  if (marketState === 'POST') {
    const sessionPrice = quote?.postMarketPrice;
    return {
      price: sessionPrice ?? regular,
      session: 'POST',
      sessionChangePercent: sessionChangeVsRegular(
        sessionPrice,
        regular,
        quote?.postMarketChangePercent,
      ),
    };
  }

  return { price: regular, session: null, sessionChangePercent: null };
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
        if (filter === 'stock') return p.transaction_type === TransactionType.Stock && p.currency === Currency.USD;
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

  const hasRonPositions = [...holdings.values()].some(h => h.currency === Currency.RON);
  const needsRonConversion = hasRonPositions && filter !== 'bvb';
  const tickersToFetch = needsRonConversion ? [...activeTickers, RON_USD_TICKER] : activeTickers;

  const {
    data: quotes,
    isLoading: quotesLoading,
    error: quotesError,
  } = useQuery<QuoteResult[]>({
    queryKey: ['compositionQuotes', filter, activeTickers],
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
    const ronToUsd = resolveQuotePrice(quoteMap.get(RON_USD_TICKER)).price;

    const totalPortfolioValue = [...holdings.entries()].reduce((sum, [ticker, holding]) => {
      const currentPrice = resolveQuotePrice(quoteMap.get(ticker)).price;
      if (holding.currency === Currency.RON && filter !== 'bvb') {
        return sum + holding.quantity * currentPrice * ronToUsd;
      }
      return sum + holding.quantity * currentPrice;
    }, 0);

    return [...holdings.entries()]
      .map(([ticker, holding]) => {
        const {
          price: currentPrice,
          session: priceSession,
          sessionChangePercent,
        } = resolveQuotePrice(quoteMap.get(ticker));
        let currentValue: number;
        let costBasisUsd: number;
        let displayCurrentPrice: number;

        if (holding.currency === Currency.RON && filter !== 'bvb') {
          currentValue = holding.quantity * currentPrice * ronToUsd;
          costBasisUsd = holding.costBasis * ronToUsd;
          displayCurrentPrice = currentPrice * ronToUsd;
        } else {
          currentValue = holding.quantity * currentPrice;
          costBasisUsd = holding.costBasis;
          displayCurrentPrice = currentPrice;
        }

        const gainLoss = currentValue - costBasisUsd;
        const weight = totalPortfolioValue > 0 ? (currentValue / totalPortfolioValue) * 100 : 0;

        return {
          ticker,
          transactionType: holding.transactionType,
          assetName: holding.assetName,
          quantity: holding.quantity,
          costBasis: costBasisUsd,
          avgCost: holding.avgCost,
          currentValue,
          currentPrice: displayCurrentPrice,
          priceSession,
          sessionChangePercent,
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