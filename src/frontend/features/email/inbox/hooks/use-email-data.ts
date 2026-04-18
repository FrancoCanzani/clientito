import { fetchViewPage, isViewSynced } from "@/features/email/inbox/queries";
import type { EmailListPage } from "@/features/email/inbox/types";
import { groupEmailsByThread } from "@/features/email/inbox/utils/group-emails-by-thread";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { queryKeys } from "@/lib/query-keys";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

const LOAD_MORE_ROOT_MARGIN = "800px 0px";

export type InboxListFilters = {
  unread?: boolean;
  starred?: boolean;
  hasAttachment?: boolean;
};

function matchesFilters(
  email: { isRead: boolean; labelIds: string[]; hasAttachment: boolean },
  filters: InboxListFilters,
): boolean {
  if (filters.unread && email.isRead) return false;
  if (filters.starred && !email.labelIds.includes("STARRED")) return false;
  if (filters.hasAttachment && !email.hasAttachment) return false;
  return true;
}

export function useEmailData({
  view,
  mailboxId,
  initialPage,
}: {
  view: string;
  mailboxId: number;
  initialPage?: EmailListPage;
}) {
  const [filters, setFilters] = useState<InboxListFilters>({});
  useEffect(() => {
    setFilters({});
  }, [view, mailboxId]);

  // null = unknown (check in flight), false = never synced, true = synced before
  const [viewPreviouslySynced, setViewPreviouslySynced] = useState<boolean | null>(null);
  const syncCheckKey = `${mailboxId}:${view}`;
  const lastSyncCheckKey = useRef<string | null>(null);

  useEffect(() => {
    if (lastSyncCheckKey.current === syncCheckKey) return;
    lastSyncCheckKey.current = syncCheckKey;
    setViewPreviouslySynced(null);
    let cancelled = false;
    isViewSynced(mailboxId, view).then((synced) => {
      if (!cancelled) setViewPreviouslySynced(synced);
    });
    return () => { cancelled = true; };
  }, [mailboxId, view, syncCheckKey]);

  const hasActiveFilters = Boolean(
    filters.unread || filters.starred || filters.hasAttachment,
  );

  const emailsQuery = useInfiniteQuery({
    queryKey: queryKeys.emails.list(view, mailboxId),
    queryFn: ({ pageParam }) =>
      fetchViewPage({
        view,
        mailboxId,
        cursor: pageParam || undefined,
      }),
    initialPageParam: "" as string,
    ...(initialPage
      ? { initialData: { pages: [initialPage], pageParams: [""] } }
      : {}),
    getNextPageParam: (lastPage) => lastPage?.cursor ?? undefined,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const allEmails = useMemo(
    () => emailsQuery.data?.pages.flatMap((page) => page.emails) ?? [],
    [emailsQuery.data],
  );
  const displayEmails = useMemo(
    () =>
      hasActiveFilters
        ? allEmails.filter((e) => matchesFilters(e, filters))
        : allEmails,
    [allEmails, filters, hasActiveFilters],
  );
  const threadGroups = useMemo(
    () => groupEmailsByThread(displayEmails),
    [displayEmails],
  );
  const hasEmails = threadGroups.length > 0;

  // Once the query succeeds for the first time this session, mark synced
  useEffect(() => {
    if (emailsQuery.isSuccess && viewPreviouslySynced === false) {
      setViewPreviouslySynced(true);
    }
  }, [emailsQuery.isSuccess, viewPreviouslySynced]);

  // isFirstSync: no previous sync recorded AND query hasn't succeeded yet
  const isFirstSync = viewPreviouslySynced !== true && !emailsQuery.isSuccess;

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
    isLoading: emailsQuery.isLoading,
    isError: emailsQuery.isError,
    isFirstSync,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    loadMoreRef,
    filters,
    setFilters,
    hasActiveFilters,
  };
}
