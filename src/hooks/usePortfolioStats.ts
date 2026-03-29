import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import { usePositions } from './usePositions';
import { PositionStatus, TransactionType, Currency } from '../types/positions';
import type { CompositionFilter } from '../components/FilterControl';

export interface PortfolioStats {
  totalValue: number;
  totalCostBasis: number;
  allTimeGain: number;
  allTimeGainPercent: number;
  totalPositions: number;
  openPositions: number;
  closedPositions: number;
  activeTickers: number;
}

type QuoteResult = {
  symbol: string;
  regularMarketPrice?: number;
};

const RON_USD_TICKER = 'RONUSD=X';

export function usePortfolioStats(filter: CompositionFilter = 'all', portfolioId: string = '') {
  const { data: positions, isLoading: positionsLoading, error: positionsError } = usePositions(portfolioId);

  const filteredPositions = (positions ?? []).filter(p => {
    if (filter === 'all') return true;
    if (filter === 'stock') return p.transaction_type === TransactionType.Stock && p.currency === Currency.USD;
    if (filter === 'crypto') return p.transaction_type === TransactionType.Crypto;
    if (filter === 'bvb') return p.currency === Currency.RON;
    return true;
  });

  const sortedPositions = [...filteredPositions].sort((a, b) => {
    if (a.buy_date !== b.buy_date) return a.buy_date < b.buy_date ? -1 : 1;
    if (a.status === PositionStatus.Buy && b.status === PositionStatus.Sell) return -1;
    if (a.status === PositionStatus.Sell && b.status === PositionStatus.Buy) return 1;
    return 0;
  });

  const lotQueues = new Map<string, Array<{ quantity: number; price: number; currency: Currency }>>();

  for (const p of sortedPositions) {
    if (p.status === PositionStatus.Buy) {
      const queue = lotQueues.get(p.ticker_symbol) ?? [];
      queue.push({ quantity: Number(p.quantity), price: Number(p.price), currency: p.currency as Currency });
      lotQueues.set(p.ticker_symbol, queue);
    } else if (p.status === PositionStatus.Sell) {
      const queue = lotQueues.get(p.ticker_symbol) ?? [];
      let remaining = Number(p.quantity);
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

  const netHoldings = new Map<string, { quantity: number; costBasis: number; currency: Currency }>();
  for (const [ticker, queue] of lotQueues.entries()) {
    const quantity = queue.reduce((sum, lot) => sum + lot.quantity, 0);
    const costBasis = queue.reduce((sum, lot) => sum + lot.quantity * lot.price, 0);
    const currency = queue[0]?.currency ?? Currency.USD;
    if (quantity > 1e-10) {
      netHoldings.set(ticker, { quantity, costBasis, currency });
    }
  }

  const activeTickers = [...netHoldings.keys()];
  const hasRonPositions = [...netHoldings.values()].some(h => h.currency === Currency.RON);
  const needsRonConversion = hasRonPositions && filter !== 'bvb';
  const tickersToFetch = needsRonConversion ? [...activeTickers, RON_USD_TICKER] : activeTickers;

  const {
    data: quotes,
    isLoading: quotesLoading,
    error: quotesError,
  } = useQuery<QuoteResult[]>({
    queryKey: ['portfolioQuotes', filter, activeTickers],
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

  const stats: PortfolioStats | null = (() => {
    if (!positions || !quotes) return null;

    const quoteMap = new Map(quotes.map(q => [q.symbol, q.regularMarketPrice ?? 0]));
    const ronToUsd = quoteMap.get(RON_USD_TICKER) ?? 0;

    let totalValue = 0;
    let totalCostBasis = 0;

    for (const [ticker, holding] of netHoldings.entries()) {
      if (holding.quantity <= 0) continue;
      const currentPrice = quoteMap.get(ticker) ?? 0;

      if (holding.currency === Currency.RON && filter !== 'bvb') {
        totalValue += holding.quantity * currentPrice * ronToUsd;
        totalCostBasis += holding.costBasis * ronToUsd;
      } else {
        totalValue += holding.quantity * currentPrice;
        totalCostBasis += holding.costBasis;
      }
    }

    const allTimeGain = totalValue - totalCostBasis;
    const allTimeGainPercent = totalCostBasis > 0 ? (allTimeGain / totalCostBasis) * 100 : 0;
    const closedPositions = filteredPositions.filter(p => p.status === PositionStatus.Sell).length;

    return {
      totalValue,
      totalCostBasis,
      allTimeGain,
      allTimeGainPercent,
      totalPositions: filteredPositions.length,
      openPositions: filteredPositions.length - closedPositions,
      closedPositions: filteredPositions.filter(p => p.status === PositionStatus.Sell).length,
      activeTickers: activeTickers.length,
    };
  })();

  return {
    stats,
    loading: positionsLoading || (activeTickers.length > 0 && quotesLoading),
    error: (positionsError ?? quotesError) as Error | null,
  };
}