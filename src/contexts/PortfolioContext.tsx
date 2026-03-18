import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { usePortfolios } from '../hooks/usePortfolios';
import type { Portfolio } from '../types/positions';

type PortfolioContextValue = {
  selectedPortfolioId: string | null;
  selectedPortfolio: Portfolio | null;
  setSelectedPortfolioId: (id: string) => void;
  portfolios: Portfolio[];
  isLoading: boolean;
};

type PortfolioProviderProps = {
  children: ReactNode;
};

export const ALL_PORTFOLIOS_ID = 'all';

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: PortfolioProviderProps) {
  const { data: portfolios = [], isLoading } = usePortfolios();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);

  useEffect(() => {
    if (portfolios.length > 0 && selectedPortfolioId === null) {
      setSelectedPortfolioId(portfolios[0].id);
    }
  }, [portfolios, selectedPortfolioId]);

  const selectedPortfolio = portfolios.find(p => p.id === selectedPortfolioId) ?? null;

  return (
    <PortfolioContext.Provider
      value={{
        selectedPortfolioId,
        selectedPortfolio,
        setSelectedPortfolioId,
        portfolios,
        isLoading,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolioContext() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolioContext must be used within PortfolioProvider');
  return ctx;
}