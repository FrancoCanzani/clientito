import { emailQueryKeys } from "@/features/email/mail/query-keys";
import type { SplitRule } from "@/db/schema";
import { isImportantThread } from "@/features/email/focus-window/is-important";
import {
  recordFocusWindowHeldCount,
  useFocusWindow,
} from "@/features/email/focus-window/use-focus-window";
import { fetchViewPage } from "@/features/email/mail/data/view-pages";
import { enqueueActiveViewSync } from "@/features/email/mail/data/view-sync";
import { fetchViewSyncStatus } from "@/features/email/mail/data/view-sync-status";
import type { EmailListPage } from "@/features/email/mail/types";
import { groupEmailsByThread } from "@/features/email/mail/utils/group-emails-by-thread";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useMailboxes } from "@/hooks/use-mailboxes";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

const LOAD_MORE_ROOT_MARGIN = "1200px 0px";
const EMPTY_PAGES: EmailListPage[] = [];

export type MailListFilters = {
  unread?: boolean;
  starred?: boolean;
  hasAttachment?: boolean;
};

export function useMailViewData({
  view,
  mailboxId,
  initialPage,
  splitRule,
}: {
  view: string;
  mailboxId: number;
  initialPage?: EmailListPage;
  splitRule?: SplitRule | null;
}) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<MailListFilters>({});
  useEffect(() => {
    setFilters({});
  }, [view, mailboxId, splitRule]);

  const hasActiveFilters = Boolean(
    filters.unread || filters.starred || filters.hasAttachment,
  );

  const emailsQuery = useInfiniteQuery({
    queryKey: emailQueryKeys.list(view, mailboxId, filters),
    queryFn: ({ pageParam }) =>
      fetchViewPage({
        view,
        mailboxId,
        cursor: pageParam || undefined,
        splitRule: splitRule ?? null,
        filters: hasActiveFilters ? filters : undefined,
      }),
    initialPageParam: "",
    ...(initialPage && !hasActiveFilters
      ? { initialData: { pages: [initialPage], pageParams: [""] } }
      : {}),
    getNextPageParam: (lastPage) => lastPage?.cursor ?? undefined,
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
    gcTime: 2 * 60_000,
    retry: false,
  });

  const viewSyncMetaQuery = useQuery({
    queryKey: emailQueryKeys.viewSyncMeta(view, mailboxId),
    queryFn: () => fetchViewSyncStatus({ view, mailboxId }),
    staleTime: 15_000,
    gcTime: 2 * 60_000,
  });
  const mailboxesQuery = useMailboxes();
  const account = mailboxesQuery.data?.accounts.find(
    (entry) => entry.mailboxId === mailboxId,
  );
  const refreshMutation = useMutation({
    mutationFn: () => enqueueActiveViewSync({ mailboxId, view }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: emailQueryKeys.list(view, mailboxId),
        }),
        queryClient.invalidateQueries({
          queryKey: emailQueryKeys.viewSyncMeta(view, mailboxId),
        }),
      ]);
    },
  });

  const { hasNextPage, isFetching, isFetchingNextPage, fetchNextPage } =
    emailsQuery;
  const [loadMoreVisible, setLoadMoreVisible] = useState(false);
  const loadedPages = useMemo(
    () => emailsQuery.data?.pages ?? EMPTY_PAGES,
    [emailsQuery.data?.pages],
  );
  const hasLoadedEmailPage = loadedPages.length > 0;

  const allEmails = useMemo(
    () => loadedPages.flatMap((page) => page.emails),
    [loadedPages],
  );
  const allThreadGroups = useMemo(
    () => groupEmailsByThread(allEmails),
    [allEmails],
  );
  const focusWindow = useFocusWindow();
  const threadGroups = useMemo(
    () =>
      focusWindow.active
        ? allThreadGroups.filter((group) => {
            if (isImportantThread(group)) return true;
            if (!focusWindow.startedAt) return true;
            return group.representative.date < focusWindow.startedAt;
          })
        : allThreadGroups,
    [allThreadGroups, focusWindow.active, focusWindow.startedAt],
  );
  const hiddenByFocusCount = useMemo(() => {
    if (!focusWindow.active || !focusWindow.startedAt) return 0;
    const startedAt = focusWindow.startedAt;
    return allThreadGroups.filter((group) => {
      if (isImportantThread(group)) return false;
      return group.representative.date >= startedAt;
    }).length;
  }, [allThreadGroups, focusWindow.active, focusWindow.startedAt]);
  const heldDuringFocusCount = useMemo(() => {
    if (!focusWindow.active || !focusWindow.startedAt) return 0;
    return allThreadGroups.filter((group) => {
      if (isImportantThread(group)) return false;
      return group.representative.date >= focusWindow.startedAt!;
    }).length;
  }, [allThreadGroups, focusWindow.active, focusWindow.startedAt]);

  useEffect(() => {
    if (!focusWindow.active) return;
    recordFocusWindowHeldCount(heldDuringFocusCount);
  }, [focusWindow.active, heldDuringFocusCount]);

  const hasEmails = threadGroups.length > 0;
  const hasLoadedRows = allEmails.length > 0;
  const isInitialViewPending = !hasLoadedEmailPage && emailsQuery.isFetching;
  const isFirstMailboxSync = Boolean(
    account &&
      !hasLoadedRows &&
      !hasActiveFilters &&
      (account.hasSynced === false || account.syncState === "ready_to_sync"),
  );
  const showEmptyState =
    hasLoadedEmailPage &&
    !emailsQuery.isFetching &&
    !hasEmails &&
    !(hasNextPage ?? false);
  const syncMeta = viewSyncMetaQuery.data;
  const hasSyncedOnce = syncMeta?.lastFetchedAt != null;
  const needsReconnect =
    account?.syncState === "needs_reconnect" ||
    syncMeta?.lastError === "reconnect_required";
  const isRateLimited = syncMeta?.lastError === "gmail_rate_limited";
  const isLoading =
    emailsQuery.isLoading ||
    (!hasEmails && !hasActiveFilters && !hasSyncedOnce);
  const isRefreshing =
    hasEmails &&
    (refreshMutation.isPending ||
      (emailsQuery.isFetching && !emailsQuery.isFetchingNextPage));

  const loadMoreRef = useIntersectionObserver<HTMLDivElement>({
    root: null,
    rootMargin: LOAD_MORE_ROOT_MARGIN,
    threshold: 0.01,
    onChange: (isIntersecting) => {
      setLoadMoreVisible(isIntersecting);
    },
  });

  useEffect(() => {
    if (!loadMoreVisible) return;
    if (!hasNextPage) return;
    if (isFetching || isFetchingNextPage) return;

    void fetchNextPage();
  }, [
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    loadMoreVisible,
  ]);

  return {
    view,
    mailboxId,
    hasEmails,
    threadGroups,
    isLoading,
    isInitialPagePending: isInitialViewPending,
    isInitialViewPending,
    isFirstMailboxSync,
    showEmptyState,
    isRefreshing,
    needsReconnect,
    isRateLimited,
    isError: emailsQuery.isError,
    isPlaceholderData: emailsQuery.isPlaceholderData,
    isFetching,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    fetchNextPage,
    loadMoreRef,
    filters,
    setFilters,
    hasActiveFilters,
    refreshView: refreshMutation.mutate,
    refreshViewAsync: refreshMutation.mutateAsync,
    isRefreshingView: refreshMutation.isPending,
    focusWindowActive: focusWindow.active,
    hiddenByFocusCount,
  };
}
