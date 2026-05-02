import { emailQueryKeys } from "@/features/email/mail/query-keys";
import {
  fetchViewPage,
  fetchViewSyncState,
} from "@/features/email/mail/queries";
import type { EmailListPage } from "@/features/email/mail/types";
import { groupEmailsByThread } from "@/features/email/mail/utils/group-emails-by-thread";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

const LOAD_MORE_ROOT_MARGIN = "800px 0px";

export type MailListFilters = {
  unread?: boolean;
  starred?: boolean;
  hasAttachment?: boolean;
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
}: {
  view: string;
  mailboxId: number;
  initialPage?: EmailListPage;
}) {
  const [filters, setFilters] = useState<MailListFilters>({});
  useEffect(() => {
    setFilters({});
  }, [view, mailboxId]);

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
      }),
    initialPageParam: "" as string,
    ...(initialPage
      ? { initialData: { pages: [initialPage], pageParams: [""] } }
      : {}),
    getNextPageParam: (lastPage) => lastPage?.cursor ?? undefined,
    placeholderData: (previousData) => previousData,
    staleTime: 0,
    gcTime: 2 * 60_000,
    retry: false,
  });

  const viewSyncQuery = useQuery({
    queryKey: emailQueryKeys.viewSyncState(view, mailboxId),
    queryFn: () => fetchViewSyncState({ view, mailboxId }),
    staleTime: 60_000,
    gcTime: 2 * 60_000,
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
  };
}
