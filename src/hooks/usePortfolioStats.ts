import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabase';
import { usePositions } from './usePositions';

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

export function usePortfolioStats() {
    const { data: positions, isLoading: positionsLoading, error: positionsError } = usePositions();

    // Sort chronologically so BUYs always come before SELLs when computing average cost
    const sortedPositions = [...(positions ?? [])].sort((a, b) => {
        if (a.buy_date !== b.buy_date) {
            return a.buy_date < b.buy_date ? -1 : 1;
        }
        // Same date: buys before sells
        if (a.transaction_type === 'buy' && b.transaction_type === 'sell') return -1;
        if (a.transaction_type === 'sell' && b.transaction_type === 'buy') return 1;
        return 0;
    });
    // Compute net quantity and cost basis per ticker using average cost method
    // When selling: remove (soldQty × avgCostPerShare) from cost basis, NOT sell price
    // Compute net quantity and cost basis per ticker using average cost method
    // When selling: remove (soldQty × avgCostPerShare) from cost basis, NOT sell price
    // FIFO: maintain a queue of lots per ticker
    const lotQueues = new Map<string, Array<{ quantity: number; price: number }>>();

    for (const p of sortedPositions) {
        if (p.transaction_type === 'buy') {
            const queue = lotQueues.get(p.ticker_symbol) ?? [];
            queue.push({ quantity: p.quantity, price: p.price });
            lotQueues.set(p.ticker_symbol, queue);
        } else if (p.transaction_type === 'sell') {
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

    // Build netHoldings from remaining lots
    const netHoldings = new Map<string, { quantity: number; costBasis: number }>();
    for (const [ticker, queue] of lotQueues.entries()) {
        const quantity = queue.reduce((sum, lot) => sum + lot.quantity, 0);
        const costBasis = queue.reduce((sum, lot) => sum + lot.quantity * lot.price, 0);
        if (quantity > 1e-10) {
            netHoldings.set(ticker, { quantity, costBasis });
        }
    }



    // Only fetch quotes for tickers where we still hold shares
    const activeTickers = [...netHoldings.entries()]
        .filter(([, v]) => v.quantity > 0)
        .map(([ticker]) => ticker);

    const {
        data: quotes,
        isLoading: quotesLoading,
        error: quotesError,
    } = useQuery<QuoteResult[]>({
        queryKey: ['portfolioQuotes', activeTickers],
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

    const stats: PortfolioStats | null = (() => {
        if (!positions || !quotes) return null;

        const quoteMap = new Map(
            quotes.map(q => [q.symbol, q.regularMarketPrice ?? 0])
        );

        let totalValue = 0;
        let totalCostBasis = 0;

        for (const [ticker, holding] of netHoldings.entries()) {
            if (holding.quantity <= 0) continue;
            const currentPrice = quoteMap.get(ticker) ?? 0;
            totalValue += holding.quantity * currentPrice;
            totalCostBasis += holding.costBasis;
        }

        const allTimeGain = totalValue - totalCostBasis;
        const allTimeGainPercent = totalCostBasis > 0
            ? (allTimeGain / totalCostBasis) * 100
            : 0;

        return {
            totalValue,
            totalCostBasis,
            allTimeGain,
            allTimeGainPercent,
            totalPositions: positions.length,
            openPositions: positions.filter(p => p.transaction_type === 'buy').length,
            closedPositions: positions.filter(p => p.transaction_type === 'sell').length,
            activeTickers: activeTickers.length,
        };
    })();

    return {
        stats,
        loading: positionsLoading || (activeTickers.length > 0 && quotesLoading),
        error: (positionsError ?? quotesError) as Error | null,
    };
}