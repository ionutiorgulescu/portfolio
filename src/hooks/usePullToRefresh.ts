import { useCallback, useEffect, useRef, useState } from 'react';

type UsePullToRefreshOptions = {
  /** Distance in px required before release triggers refresh. */
  threshold?: number;
  /** Max visual pull distance in px. */
  maxPull?: number;
  /** Disable the gesture (e.g. while no handler is registered). */
  disabled?: boolean;
};

type UsePullToRefreshResult = {
  pullDistance: number;
  isRefreshing: boolean;
  isPulling: boolean;
};

/** Elements that own horizontal gestures (charts) must opt out of pull-to-refresh. */
const IGNORE_PULL_SELECTOR = '.portfolio-chart, [data-no-pull-refresh]';

function shouldIgnorePullTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(IGNORE_PULL_SELECTOR));
}

/**
 * Touch pull-to-refresh when `scrollElement` is scrolled to the top.
 * Pass the dedicated scroll root element (not window/document).
 */
export function usePullToRefresh(
  scrollElement: HTMLElement | null,
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
    if (!scrollElement || disabled) {
      resetPull();
      return;
    }

    const getScrollTop = () => scrollElement.scrollTop;

    const onTouchStart = (event: TouchEvent) => {
      if (isRefreshingRef.current) return;
      // Chart scrub starts at scrollTop 0 after load; don't steal that gesture.
      if (shouldIgnorePullTarget(event.target)) {
        startYRef.current = null;
        return;
      }
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

    scrollElement.addEventListener('touchstart', onTouchStart, { passive: true });
    scrollElement.addEventListener('touchmove', onTouchMove, { passive: false });
    scrollElement.addEventListener('touchend', onTouchEnd);
    scrollElement.addEventListener('touchcancel', resetPull);

    return () => {
      scrollElement.removeEventListener('touchstart', onTouchStart);
      scrollElement.removeEventListener('touchmove', onTouchMove);
      scrollElement.removeEventListener('touchend', onTouchEnd);
      scrollElement.removeEventListener('touchcancel', resetPull);
    };
  }, [disabled, maxPull, resetPull, scrollElement, threshold]);

  return { pullDistance, isRefreshing, isPulling };
}
