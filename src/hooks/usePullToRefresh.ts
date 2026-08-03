import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

type UsePullToRefreshOptions = {
  /** Distance in px required before release triggers refresh. */
  threshold?: number;
  /** Max visual pull distance in px. */
  maxPull?: number;
  /** Disable the gesture (e.g. while already loading). */
  disabled?: boolean;
};

type UsePullToRefreshResult = {
  pullDistance: number;
  isRefreshing: boolean;
  isPulling: boolean;
};

function getScrollTop() {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

/**
 * Touch pull-to-refresh when the page is scrolled to the top.
 * Attach the returned handlers via the container ref.
 */
export function usePullToRefresh(
  containerRef: RefObject<HTMLElement | null>,
  onRefresh: () => void | Promise<void>,
  options: UsePullToRefreshOptions = {},
): UsePullToRefreshResult {
  const { threshold = 72, maxPull = 120, disabled = false } = options;

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const startYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  const resetPull = useCallback(() => {
    startYRef.current = null;
    pullDistanceRef.current = 0;
    setPullDistance(0);
    setIsPulling(false);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    const onTouchStart = (event: TouchEvent) => {
      if (isRefreshingRef.current) return;
      if (getScrollTop() > 0) {
        startYRef.current = null;
        return;
      }
      startYRef.current = event.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (isRefreshingRef.current || startYRef.current === null) return;
      if (getScrollTop() > 0) {
        resetPull();
        return;
      }

      const currentY = event.touches[0]?.clientY ?? startYRef.current;
      const rawDelta = currentY - startYRef.current;
      if (rawDelta <= 0) {
        if (pullDistanceRef.current !== 0) {
          pullDistanceRef.current = 0;
          setPullDistance(0);
          setIsPulling(false);
        }
        return;
      }

      // Resistive pull so it doesn't feel overly springy.
      const distance = Math.min(maxPull, rawDelta * 0.45);
      pullDistanceRef.current = distance;
      setPullDistance(distance);
      setIsPulling(true);

      // Avoid native overscroll bounce fighting the custom indicator.
      if (event.cancelable && distance > 0) {
        event.preventDefault();
      }
    };

    const onTouchEnd = async () => {
      if (isRefreshingRef.current || startYRef.current === null) {
        resetPull();
        return;
      }

      const shouldRefresh = pullDistanceRef.current >= threshold;
      startYRef.current = null;

      if (!shouldRefresh) {
        resetPull();
        return;
      }

      setIsPulling(false);
      setIsRefreshing(true);
      setPullDistance(threshold * 0.6);

      try {
        await onRefreshRef.current();
      } finally {
        setIsRefreshing(false);
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', resetPull);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', resetPull);
    };
  }, [containerRef, disabled, maxPull, resetPull, threshold]);

  return { pullDistance, isRefreshing, isPulling };
}
