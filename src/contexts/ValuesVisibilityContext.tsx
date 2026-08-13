import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

const VALUES_HIDDEN_STORAGE_KEY = 'dashboardStats.valuesHidden';
const PIN_HASH_STORAGE_KEY = 'dashboardStats.valuesPinHash';
const PIN_PATTERN = /^\d{4}$/;

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

function readPinHash(): string | null {
  try {
    const stored = localStorage.getItem(PIN_HASH_STORAGE_KEY);
    if (!stored) return null;
    // Previous WebCrypto SHA-256 hashes were 64 hex chars and can hang on iOS PWAs.
    if (stored.length === 64) {
      localStorage.removeItem(PIN_HASH_STORAGE_KEY);
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

function writePinHash(hash: string | null) {
  try {
    if (hash == null) {
      localStorage.removeItem(PIN_HASH_STORAGE_KEY);
      return;
    }
    localStorage.setItem(PIN_HASH_STORAGE_KEY, hash);
  } catch {
    // Ignore quota / private-mode failures
  }
}

function hashPin(pin: string): string {
  const input = `portfolio.visibility.pin.v1:${pin}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = Math.imul(h2 ^ code, 0x811c9dc5);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

type ValuesVisibilityContextValue = {
  valuesHidden: boolean;
  hasPin: boolean;
  lockWithPin: (pin: string) => void;
  unlockWithPin: (pin: string) => boolean;
};

const ValuesVisibilityContext = createContext<ValuesVisibilityContextValue | null>(null);

type ValuesVisibilityProviderProps = {
  children: ReactNode;
};

export function ValuesVisibilityProvider({ children }: ValuesVisibilityProviderProps) {
  const [valuesHidden, setValuesHidden] = useState(readValuesHidden);
  const [pinHash, setPinHash] = useState(readPinHash);

  const lockWithPin = useCallback((pin: string) => {
    if (!PIN_PATTERN.test(pin)) return;
    const hash = hashPin(pin);
    writePinHash(hash);
    setPinHash(hash);
    writeValuesHidden(true);
    setValuesHidden(true);
  }, []);

  const unlockWithPin = useCallback((pin: string) => {
    const stored = pinHash ?? readPinHash();
    if (!stored) {
      writeValuesHidden(false);
      setValuesHidden(false);
      return true;
    }

    if (!PIN_PATTERN.test(pin) || hashPin(pin) !== stored) return false;

    writeValuesHidden(false);
    setValuesHidden(false);
    return true;
  }, [pinHash]);

  const value = useMemo(
    () => ({
      valuesHidden,
      hasPin: pinHash != null,
      lockWithPin,
      unlockWithPin,
    }),
    [valuesHidden, pinHash, lockWithPin, unlockWithPin],
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
