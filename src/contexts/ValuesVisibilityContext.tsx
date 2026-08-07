import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

const VALUES_HIDDEN_STORAGE_KEY = 'dashboardStats.valuesHidden';

function readValuesHidden(): boolean {
  try {
    return localStorage.getItem(VALUES_HIDDEN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeValuesHidden(hidden: boolean) {
  try {
    localStorage.setItem(VALUES_HIDDEN_STORAGE_KEY, String(hidden));
  } catch {
    // Ignore quota / private-mode failures
  }
}

type ValuesVisibilityContextValue = {
  valuesHidden: boolean;
  toggleValuesHidden: () => void;
};

const ValuesVisibilityContext = createContext<ValuesVisibilityContextValue | null>(null);

type ValuesVisibilityProviderProps = {
  children: ReactNode;
};

export function ValuesVisibilityProvider({ children }: ValuesVisibilityProviderProps) {
  const [valuesHidden, setValuesHidden] = useState(readValuesHidden);

  const toggleValuesHidden = useCallback(() => {
    setValuesHidden((hidden) => {
      const next = !hidden;
      writeValuesHidden(next);
      return next;
    });
  }, []);

  return (
    <ValuesVisibilityContext.Provider value={{ valuesHidden, toggleValuesHidden }}>
      {children}
    </ValuesVisibilityContext.Provider>
  );
}

export function useValuesVisibility() {
  const ctx = useContext(ValuesVisibilityContext);
  if (!ctx) throw new Error('useValuesVisibility must be used within ValuesVisibilityProvider');
  return ctx;
}
