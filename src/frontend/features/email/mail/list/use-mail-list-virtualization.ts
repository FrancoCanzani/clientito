import { VIEW_PAGE_SIZE } from "@/features/email/mail/data/constants";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, type RefObject } from "react";

const LOAD_MORE_PREFETCH_THRESHOLD = 8;

export function useMailListVirtualization({
  scrollRef,
  rowHeight,
  loadedCount,
  isInitialPagePending,
  hasNextPage,
  isFetching,
  isFetchingNextPage,
  fetchNextPage,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  rowHeight: number;
  loadedCount: number;
  isInitialPagePending: boolean;
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
}) {
  const placeholderCount =
    isInitialPagePending || hasNextPage || isFetchingNextPage
      ? VIEW_PAGE_SIZE
      : 0;
  const virtualCount = isInitialPagePending
    ? placeholderCount
    : loadedCount + placeholderCount;

  const virtualizer = useVirtualizer({
    count: virtualCount,
    estimateSize: () => rowHeight,
    overscan: 10,
    getScrollElement: () => scrollRef.current,
  });

  useEffect(() => {
    virtualizer.measure();
    // virtualizer is intentionally omitted: its identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowHeight]);

  const virtualItems = virtualizer.getVirtualItems();
  const lastVirtualIndex =
    virtualItems.length > 0 ? virtualItems[virtualItems.length - 1]!.index : -1;

  useEffect(() => {
    if (!hasNextPage) return;
    if (isFetching || isFetchingNextPage) return;
    if (lastVirtualIndex < loadedCount - LOAD_MORE_PREFETCH_THRESHOLD) return;

    void fetchNextPage();
  }, [
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    lastVirtualIndex,
    loadedCount,
  ]);

  return { virtualizer, virtualItems, virtualCount };
}
