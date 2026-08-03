import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

type RefreshHandler = () => void | Promise<void>;

type PullToRefreshContextValue = {
  register: (handler: RefreshHandler) => void;
  unregister: () => void;
};

const PullToRefreshContext = createContext<PullToRefreshContextValue | null>(null);

type PullToRefreshProviderProps = {
  children: ReactNode;
  onHandlerChange: (handler: RefreshHandler | null) => void;
};

export function PullToRefreshProvider({
  children,
  onHandlerChange,
}: PullToRefreshProviderProps) {
  const onHandlerChangeRef = useRef(onHandlerChange);
  onHandlerChangeRef.current = onHandlerChange;

  const register = useCallback((handler: RefreshHandler) => {
    onHandlerChangeRef.current(handler);
  }, []);

  const unregister = useCallback(() => {
    onHandlerChangeRef.current(null);
  }, []);

  const value = useMemo(
    () => ({ register, unregister }),
    [register, unregister],
  );

  return (
    <PullToRefreshContext.Provider value={value}>
      {children}
    </PullToRefreshContext.Provider>
  );
}

/** Register a page-level refresh handler for the AppShell pull-to-refresh root. */
export function useRegisterPullToRefresh(onRefresh: RefreshHandler) {
  const ctx = useContext(PullToRefreshContext);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!ctx) return;

    ctx.register(() => onRefreshRef.current());
    return () => ctx.unregister();
  }, [ctx]);
}
