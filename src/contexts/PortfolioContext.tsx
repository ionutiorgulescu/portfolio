import { createContext, useCallback, useContext, useEffect, useState } from 'react';
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

const DEFAULT_PORTFOLIO_STORAGE_KEY = 'defaultPortfolioId';

function readStoredPortfolioId(): string | null {
  try {
    return localStorage.getItem(DEFAULT_PORTFOLIO_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredPortfolioId(id: string) {
  try {
    localStorage.setItem(DEFAULT_PORTFOLIO_STORAGE_KEY, id);
  } catch {
    // Ignore quota / private-mode failures
  }
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: PortfolioProviderProps) {
  const { data: portfolios = [], isLoading } = usePortfolios();
  const [selectedPortfolioId, setSelectedPortfolioIdState] = useState<string | null>(null);

  useEffect(() => {
    if (portfolios.length === 0 || selectedPortfolioId !== null) return;

    const stored = readStoredPortfolioId();
    const isValid =
      stored === ALL_PORTFOLIOS_ID ||
      (!!stored && portfolios.some((p) => p.id === stored));

    setSelectedPortfolioIdState(isValid && stored ? stored : portfolios[0].id);
  }, [portfolios, selectedPortfolioId]);

  const setSelectedPortfolioId = useCallback((id: string) => {
    setSelectedPortfolioIdState(id);
    writeStoredPortfolioId(id);
  }, []);

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