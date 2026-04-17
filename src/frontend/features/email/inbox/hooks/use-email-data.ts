import { pullViewMore } from "@/db/sync";
import { useLocalSyncSnapshot } from "@/hooks/use-local-sync";
import { fetchEmails, pageSizeForView } from "@/features/email/inbox/queries";
import type { EmailListResponse } from "@/features/email/inbox/types";
import { groupEmailsByThread } from "@/features/email/inbox/utils/group-emails-by-thread";
import { viewToGmailFilter } from "@/features/email/inbox/utils/view-gmail-filter";
import { useAuth } from "@/hooks/use-auth";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { queryKeys } from "@/lib/query-keys";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";


const LOAD_MORE_ROOT_MARGIN = "800px 0px";
const GMAIL_PULL_MAX_PAGES_PER_TRIGGER = 5;

export type InboxListFilters = {
  unread?: boolean;
  starred?: boolean;
  hasAttachment?: boolean;
};

function filtersToKey(filters?: InboxListFilters): string | undefined {
  if (!filters) return undefined;
  const parts: string[] = [];
  if (filters.unread) parts.push("unread");
  if (filters.starred) parts.push("starred");
  if (filters.hasAttachment) parts.push("attach");
  return parts.length > 0 ? parts.join("|") : undefined;
}

function filtersToGmailQuery(filters: InboxListFilters): string | undefined {
  const parts: string[] = [];
  if (filters.unread) parts.push("is:unread");
  if (filters.starred) parts.push("is:starred");
  if (filters.hasAttachment) parts.push("has:attachment");
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export function useEmailData({
  view,
  mailboxId,
  initialPage,
}: {
  view: string;
  mailboxId: number;
  initialPage?: EmailListResponse;
}) {

  const { user } = useAuth();
  const localSync = useLocalSyncSnapshot(user?.id, mailboxId);
  const isInitialSync = localSync.status === "initial";
  const isSyncing = localSync.status !== "idle";

  const [filters, setFilters] = useState<InboxListFilters>({});
  useEffect(() => {
    setFilters({});
  }, [view, mailboxId]);

  const filterKey = filtersToKey(filters);
  const hasActiveFilters = filterKey !== undefined;

  const pageSize = pageSizeForView(view);
  const emailsQuery = useInfiniteQuery({
    queryKey: queryKeys.emails.list(view, mailboxId, filterKey),
    queryFn: ({ pageParam }) =>
      fetchEmails({
        view,
        mailboxId,
        limit: pageSize,
        cursor: pageParam || undefined,
        isRead: filters?.unread ? "false" : undefined,
        starred: filters?.starred,
        hasAttachment: filters?.hasAttachment,
      }),
    initialPageParam: 0 as number,
    ...(initialPage && !hasActiveFilters
      ? {
          initialData: {
            pages: [initialPage],
            pageParams: [0],
          },
        }
      : {}),
    getNextPageParam: (lastPage) =>
      lastPage?.pagination?.hasMore
        ? lastPage.pagination.cursor
        : undefined,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const displayEmails = useMemo(
    () => emailsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [emailsQuery.data],
  );
  const threadGroups = useMemo(
    () => groupEmailsByThread(displayEmails),
    [displayEmails],
  );
  const hasEmails = threadGroups.length > 0;

  const { hasNextPage, isFetching, isFetchingNextPage, fetchNextPage } = emailsQuery;

  const [gmailExhausted, setGmailExhausted] = useState(false);
  const [isPullingFromGmail, setIsPullingFromGmail] = useState(false);

  useEffect(() => {
    setGmailExhausted(false);
  }, [view, mailboxId]);

  const canPullFromGmail =
    !!user?.id && viewToGmailFilter(view) !== null && !gmailExhausted;

  const gmailExtraQuery = hasActiveFilters
    ? filtersToGmailQuery(filters)
    : undefined;

  const oldestLoadedDate = useMemo(() => {
    const last = displayEmails[displayEmails.length - 1];
    return last?.date ?? undefined;
  }, [displayEmails]);

  const pullMoreFromGmail = useCallback(async () => {
    if (!user?.id) return;
    setIsPullingFromGmail(true);
    try {
      for (let i = 0; i < GMAIL_PULL_MAX_PAGES_PER_TRIGGER; i++) {
        const { inserted, hasMore } = await pullViewMore(
          user.id,
          mailboxId,
          view,
          {
            extraQuery: gmailExtraQuery,
            beforeMs: hasActiveFilters ? oldestLoadedDate : undefined,
          },
        );
        if (!hasMore) {
          setGmailExhausted(true);
          return;
        }
        if (inserted > 0) return;
      }
    } catch {
      // Surfaced via existing sync/query error states.
    } finally {
      setIsPullingFromGmail(false);
    }
  }, [
    user?.id,
    mailboxId,
    view,
    hasActiveFilters,
    gmailExtraQuery,
    oldestLoadedDate,
  ]);

  const loadMoreRef = useIntersectionObserver<HTMLDivElement>({
    root: null,
    rootMargin: LOAD_MORE_ROOT_MARGIN,
    threshold: 0.01,
    onChange: (isIntersecting) => {
      if (!isIntersecting || isFetching) return;
      if (hasNextPage) {
        if (!isFetchingNextPage) fetchNextPage();
        return;
      }
      if (canPullFromGmail && !isPullingFromGmail) {
        void pullMoreFromGmail();
      }
    },
  });

  return {
    view,
    mailboxId,
    hasEmails,
    threadGroups,
    isLoading: emailsQuery.isLoading,
    isError: emailsQuery.isError,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    isSyncing,
    isInitialSync,
    loadMoreRef,
    canPullFromGmail,
    isPullingFromGmail,
    filters,
    setFilters,
    hasActiveFilters,
    pullMoreFromGmail,
  };
}
