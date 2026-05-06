import { emailQueryKeys } from "@/features/email/mail/query-keys";
import type { SplitRule } from "@/db/schema";
import {
  enqueueActiveViewSync,
  fetchViewPage,
  fetchViewSyncMeta,
  fetchViewSyncState,
} from "@/features/email/mail/queries";
import type { EmailListPage } from "@/features/email/mail/types";
import { groupEmailsByThread } from "@/features/email/mail/utils/group-emails-by-thread";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

const LOAD_MORE_ROOT_MARGIN = "1200px 0px";

export type MailListFilters = {
  unread?: boolean;
  starred?: boolean;
  hasAttachment?: boolean;
};

export type ViewSyncStatusKind =
  | "fetching_first_page"
  | "cached"
  | "refreshing"
  | "gmail_rate_limited"
  | "reconnect_required";

export type ViewSyncStatus = {
  kind: ViewSyncStatusKind;
  label: string;
  detail: string;
  lastFetchedAt: number | null;
  lastErrorAt: number | null;
};

function matchesFilters(
  email: { isRead: boolean; labelIds: string[]; hasAttachment: boolean },
  filters: MailListFilters,
): boolean {
  if (filters.unread && email.isRead) return false;
  if (filters.starred && !email.labelIds.includes("STARRED")) return false;
  if (filters.hasAttachment && !email.hasAttachment) return false;
  return true;
}

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
    queryKey: emailQueryKeys.list(view, mailboxId),
    queryFn: ({ pageParam }) =>
      fetchViewPage({
        view,
        mailboxId,
        cursor: pageParam || undefined,
        splitRule: splitRule ?? null,
      }),
    initialPageParam: "" as string,
    ...(initialPage
      ? { initialData: { pages: [initialPage], pageParams: [""] } }
      : {}),
    getNextPageParam: (lastPage) => lastPage?.cursor ?? undefined,
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
    gcTime: 2 * 60_000,
    retry: false,
  });

  const viewSyncQuery = useQuery({
    queryKey: emailQueryKeys.viewSyncState(view, mailboxId),
    queryFn: () => fetchViewSyncState({ view, mailboxId }),
    staleTime: 60_000,
    gcTime: 2 * 60_000,
  });
  const viewSyncMetaQuery = useQuery({
    queryKey: emailQueryKeys.viewSyncMeta(view, mailboxId),
    queryFn: () => fetchViewSyncMeta({ view, mailboxId }),
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
        queryClient.invalidateQueries({
          queryKey: emailQueryKeys.viewSyncState(view, mailboxId),
        }),
      ]);
    },
  });

  const allEmails = useMemo(
    () => emailsQuery.data?.pages.flatMap((page) => page.emails) ?? [],
    [emailsQuery.data],
  );
  const displayEmails = useMemo(
    () =>
      hasActiveFilters
        ? allEmails.filter((email) => matchesFilters(email, filters))
        : allEmails,
    [filters, hasActiveFilters, allEmails],
  );
  const threadGroups = useMemo(
    () => groupEmailsByThread(displayEmails),
    [displayEmails],
  );
  const hasEmails = threadGroups.length > 0;
  const isInitialViewSyncing =
    !hasEmails &&
    !hasActiveFilters &&
    viewSyncQuery.data === false &&
    emailsQuery.isFetching;
  const syncMeta = viewSyncMetaQuery.data ?? {
    lastFetchedAt: null,
    lastError: null,
    lastErrorAt: null,
    lastCursorType: null,
  };
  const syncStatus = useMemo<ViewSyncStatus>(() => {
    if (account?.syncState === "needs_reconnect") {
      return {
        kind: "reconnect_required",
        label: "Reconnect required",
        detail: "Google access expired. Reconnect this mailbox in Settings.",
        lastFetchedAt: syncMeta.lastFetchedAt,
        lastErrorAt: syncMeta.lastErrorAt,
      };
    }
    if (syncMeta.lastError === "gmail_rate_limited") {
      return {
        kind: "gmail_rate_limited",
        label: "Gmail rate limited",
        detail: "Gmail asked Duomo to slow down. Try refreshing again later.",
        lastFetchedAt: syncMeta.lastFetchedAt,
        lastErrorAt: syncMeta.lastErrorAt,
      };
    }
    if (syncMeta.lastError === "reconnect_required") {
      return {
        kind: "reconnect_required",
        label: "Reconnect required",
        detail: "Google access expired. Reconnect this mailbox in Settings.",
        lastFetchedAt: syncMeta.lastFetchedAt,
        lastErrorAt: syncMeta.lastErrorAt,
      };
    }
    if (isInitialViewSyncing) {
      return {
        kind: "fetching_first_page",
        label: "Fetching first page",
        detail: "Loading the first messages for this view from Gmail.",
        lastFetchedAt: syncMeta.lastFetchedAt,
        lastErrorAt: syncMeta.lastErrorAt,
      };
    }
    if (
      hasEmails &&
      (refreshMutation.isPending ||
        (emailsQuery.isFetching && !emailsQuery.isFetchingNextPage))
    ) {
      return {
        kind: "refreshing",
        label: "Refreshing",
        detail: "Checking Gmail for newer messages.",
        lastFetchedAt: syncMeta.lastFetchedAt,
        lastErrorAt: syncMeta.lastErrorAt,
      };
    }
    return {
      kind: "cached",
      label: "Cached",
      detail: syncMeta.lastFetchedAt
        ? `Last refreshed ${new Date(syncMeta.lastFetchedAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}.`
        : "Showing the local browser cache.",
      lastFetchedAt: syncMeta.lastFetchedAt,
      lastErrorAt: syncMeta.lastErrorAt,
    };
  }, [
    account?.syncState,
    emailsQuery.isFetching,
    emailsQuery.isFetchingNextPage,
    hasEmails,
    isInitialViewSyncing,
    refreshMutation.isPending,
    syncMeta.lastError,
    syncMeta.lastErrorAt,
    syncMeta.lastFetchedAt,
  ]);

  const { hasNextPage, isFetching, isFetchingNextPage, fetchNextPage } =
    emailsQuery;

  const loadMoreRef = useIntersectionObserver<HTMLDivElement>({
    root: null,
    rootMargin: LOAD_MORE_ROOT_MARGIN,
    threshold: 0.01,
    onChange: (isIntersecting) => {
      if (!isIntersecting || isFetching || isFetchingNextPage) return;
      if (hasNextPage) fetchNextPage();
    },
  });

  return {
    view,
    mailboxId,
    hasEmails,
    threadGroups,
    isLoading: emailsQuery.isLoading || isInitialViewSyncing,
    isError: emailsQuery.isError,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    fetchNextPage,
    loadMoreRef,
    filters,
    setFilters,
    hasActiveFilters,
    syncStatus,
    refreshView: refreshMutation.mutate,
    isRefreshingView: refreshMutation.isPending,
  };
}
