import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import { usePositions } from './usePositions';
import { PositionStatus } from '../types/positions';

export interface TickerComposition {
  ticker: string;
  assetName: string;
  quantity: number;
  costBasis: number;
  currentValue: number;
  gainLoss: number;
  weight: number;
}

type QuoteResult = {
  symbol: string;
  regularMarketPrice?: number;
};

function buildFifoHoldings(positions: ReturnType<typeof usePositions>['data']) {
  if (!positions) return new Map<string, { quantity: number; costBasis: number; assetName: string }>();

  // Sort chronologically, buys before sells on same date
  const sorted = [...positions].sort((a, b) => {
    if (a.buy_date !== b.buy_date) return a.buy_date < b.buy_date ? -1 : 1;
    if (a.status === PositionStatus.Buy && b.status === PositionStatus.Sell) return -1;
    if (a.status === PositionStatus.Sell && b.status === PositionStatus.Buy) return 1;
    return 0;
  });

  // FIFO lot queues per ticker
  const lotQueues = new Map<string, Array<{ quantity: number; price: number; assetName: string }>>();

  for (const p of sorted) {
    if (p.status === PositionStatus.Buy) {
      const queue = lotQueues.get(p.ticker_symbol) ?? [];
      queue.push({ quantity: p.quantity, price: p.price, assetName: p.asset_name });
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

  // Build holdings from remaining lots
  const holdings = new Map<string, { quantity: number; costBasis: number; assetName: string }>();
  for (const [ticker, queue] of lotQueues.entries()) {
    const quantity = queue.reduce((sum, lot) => sum + lot.quantity, 0);
    const costBasis = queue.reduce((sum, lot) => sum + lot.quantity * lot.price, 0);
    const assetName = queue[0]?.assetName ?? ticker;
    if (quantity > 1e-10) {
      holdings.set(ticker, { quantity, costBasis, assetName });
    }
  }

  return holdings;
}

export function usePortfolioComposition() {
  const { data: positions, isLoading: positionsLoading, error: positionsError } = usePositions();

  const holdings = buildFifoHoldings(positions);
  const activeTickers = [...holdings.keys()];

  const {
    data: quotes,
    isLoading: quotesLoading,
    error: quotesError,
  } = useQuery<QuoteResult[]>({
    queryKey: ['compositionQuotes', activeTickers],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-quotas', {
        body: { tickers: activeTickers },
      });
      if (error) throw error;
      return data as QuoteResult[];
    },
    enabled: activeTickers.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const composition: TickerComposition[] = (() => {
    if (!quotes) return [];

    const quoteMap = new Map(
      quotes.map(q => [q.symbol, q.regularMarketPrice ?? 0])
    );

    const totalPortfolioValue = [...holdings.entries()].reduce((sum, [ticker, holding]) => {
      return sum + holding.quantity * (quoteMap.get(ticker) ?? 0);
    }, 0);

    return [...holdings.entries()]
      .map(([ticker, holding]) => {
        const currentPrice = quoteMap.get(ticker) ?? 0;
        const currentValue = holding.quantity * currentPrice;
        const gainLoss = currentValue - holding.costBasis;
        const weight = totalPortfolioValue > 0 ? (currentValue / totalPortfolioValue) * 100 : 0;

        return {
          ticker,
          assetName: holding.assetName,
          quantity: holding.quantity,
          costBasis: holding.costBasis,
          currentValue,
          gainLoss,
          weight,
        };
      })
      .sort((a, b) => b.weight - a.weight); // descending by weight
  })();

  return {
    composition,
    loading: positionsLoading || (activeTickers.length > 0 && quotesLoading),
    error: (positionsError ?? quotesError) as Error | null,
  };
}