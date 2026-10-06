import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

const VALUES_HIDDEN_STORAGE_KEY = 'dashboardStats.valuesHidden';
const LEGACY_PIN_HASH_STORAGE_KEY = 'dashboardStats.valuesPinHash';
const PIN_PATTERN = /^\d{4}$/;

function readEnvPin(): string | null {
  const pin = import.meta.env.VITE_VALUES_PIN?.trim() ?? '';
  return PIN_PATTERN.test(pin) ? pin : null;
}

const ENV_PIN = readEnvPin();

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

function clearLegacyPinHash() {
  try {
    localStorage.removeItem(LEGACY_PIN_HASH_STORAGE_KEY);
  } catch {
    // Ignore private-mode failures
  }
}

clearLegacyPinHash();

type UnlockResult = true | false | string;

type ValuesVisibilityContextValue = {
  valuesHidden: boolean;
  hideValues: () => void;
  unlockWithPin: (pin: string) => UnlockResult;
};

const ValuesVisibilityContext = createContext<ValuesVisibilityContextValue | null>(null);

type ValuesVisibilityProviderProps = {
  children: ReactNode;
};

export function ValuesVisibilityProvider({ children }: ValuesVisibilityProviderProps) {
  const [valuesHidden, setValuesHidden] = useState(readValuesHidden);

  const hideValues = useCallback(() => {
    writeValuesHidden(true);
    setValuesHidden(true);
  }, []);

  const unlockWithPin = useCallback((pin: string): UnlockResult => {
    if (!ENV_PIN) return 'Visibility PIN is not configured.';
    if (!PIN_PATTERN.test(pin) || pin !== ENV_PIN) return false;

    writeValuesHidden(false);
    setValuesHidden(false);
    return true;
  }, []);

  const value = useMemo(
    () => ({
      valuesHidden,
      hideValues,
      unlockWithPin,
    }),
    [valuesHidden, hideValues, unlockWithPin],
  );

  return (
    <ValuesVisibilityContext.Provider value={value}>
      {children}
    </ValuesVisibilityContext.Provider>
  );
}

export function useValuesVisibility() {
  const ctx = useContext(ValuesVisibilityContext);
  if (!ctx) throw new Error('useValuesVisibility must be used within ValuesVisibilityProvider');
  return ctx;
}
