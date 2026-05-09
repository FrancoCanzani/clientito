import { type RefObject, useEffect, useRef, useState } from "react";

export function useMobilePullToRefresh({
  containerRef,
  enabled,
  onRefresh,
  threshold = 60,
  maxPull = 96,
  resistance = 0.45,
  minIndicatorMs = 420,
  maxIndicatorMs = 850,
}: {
  containerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  onRefresh: () => Promise<unknown>;
  threshold?: number;
  maxPull?: number;
  resistance?: number;
  minIndicatorMs?: number;
  maxIndicatorMs?: number;
}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const releasedRef = useRef(false);
  const mountedRef = useRef(true);
  const pullDistanceRef = useRef(0);
  const refreshRef = useRef(onRefresh);
  const isRefreshingRef = useRef(isRefreshing);
  const gestureDirectionRef = useRef<"vertical" | "horizontal" | null>(null);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!enabled || !el) return;

    const onStart = (event: TouchEvent) => {
      if (isRefreshingRef.current) return;
      if (event.touches.length !== 1) return;
      if (el.scrollTop > 0) return;
      const touch = event.touches[0];
      startXRef.current = touch?.clientX ?? null;
      startYRef.current = touch?.clientY ?? null;
      pullingRef.current =
        startXRef.current != null && startYRef.current != null;
      releasedRef.current = false;
      gestureDirectionRef.current = null;
    };

    const onMove = (event: TouchEvent) => {
      if (isRefreshingRef.current || !pullingRef.current) return;
      if (event.touches.length !== 1) return;
      const startX = startXRef.current;
      const startY = startYRef.current;
      if (startX == null || startY == null) return;
      const touch = event.touches[0];
      const touchX = touch?.clientX ?? startX;
      const touchY = touch?.clientY ?? startY;
      const dx = touchX - startX;
      const delta = touchY - startY;

      if (!gestureDirectionRef.current) {
        if (Math.abs(dx) < 8 && Math.abs(delta) < 8) return;
        gestureDirectionRef.current =
          Math.abs(delta) > Math.abs(dx) ? "vertical" : "horizontal";
      }

      if (gestureDirectionRef.current !== "vertical") {
        pullingRef.current = false;
        setPullDistance(0);
        return;
      }

      if (delta <= 0) {
        setPullDistance(0);
        return;
      }
      if (el.scrollTop > 0) {
        setPullDistance(0);
        return;
      }
      const next = Math.min(maxPull, delta * resistance);
      if (next > 0 && event.cancelable) {
        event.preventDefault();
      }
      setPullDistance(next);
    };

    const onEnd = () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      startXRef.current = null;
      startYRef.current = null;
      gestureDirectionRef.current = null;
      if (releasedRef.current) return;
      releasedRef.current = true;

      if (pullDistanceRef.current < threshold || isRefreshingRef.current) {
        setPullDistance(0);
        return;
      }

      const run = async () => {
        setIsRefreshing(true);
        setPullDistance(0);
        const startedAt = Date.now();
        try {
          const refreshPromise = refreshRef.current().catch(() => undefined);
          await Promise.race([
            refreshPromise,
            new Promise((resolve) =>
              window.setTimeout(resolve, maxIndicatorMs),
            ),
          ]);
        } finally {
          const remaining = minIndicatorMs - (Date.now() - startedAt);
          if (remaining > 0 && mountedRef.current) {
            await new Promise((resolve) =>
              window.setTimeout(resolve, remaining),
            );
          }
          if (mountedRef.current) {
            setIsRefreshing(false);
            setPullDistance(0);
          }
        }
      };
      void run();
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [
    containerRef,
    enabled,
    maxIndicatorMs,
    maxPull,
    minIndicatorMs,
    resistance,
    threshold,
  ]);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  return {
    pullDistance,
    isRefreshing,
    isReady: pullDistance >= threshold,
  };
}
