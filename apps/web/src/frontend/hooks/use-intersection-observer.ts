import { useCallback, useRef } from "react";

type IntersectionOptions = {
  root?: Element | Document | null;
  rootMargin?: string;
  threshold?: number | number[];
  onChange?: (
    isIntersecting: boolean,
    entry: IntersectionObserverEntry,
  ) => void;
};

export function useIntersectionObserver<T extends Element>({
  root = null,
  rootMargin = "0px",
  threshold = 0,
  onChange,
}: IntersectionOptions = {}) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  return useCallback(
    (node: T | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!node) return;

      const observer = new IntersectionObserver(
        (entries) => {
          const first = entries[0];
          if (!first) return;
          onChange?.(first.isIntersecting, first);
        },
        { root, rootMargin, threshold },
      );

      observer.observe(node);
      observerRef.current = observer;
    },
    [onChange, root, rootMargin, threshold],
  );
}
