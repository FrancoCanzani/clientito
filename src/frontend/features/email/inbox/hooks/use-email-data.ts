import { fetchViewPage } from "@/features/email/inbox/queries";
import type { EmailListPage } from "@/features/email/inbox/types";
import { groupEmailsByThread } from "@/features/email/inbox/utils/group-emails-by-thread";
import type { SplitViewRow } from "@/db/schema";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { queryKeys } from "@/lib/query-keys";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

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
  activeSplit,
}: {
  view: string;
  mailboxId: number;
  initialPage?: EmailListPage;
  activeSplit?: SplitViewRow | null;
}) {
  const [filters, setFilters] = useState<InboxListFilters>({});
  useEffect(() => {
    setFilters({});
  }, [view, mailboxId]);

  const hasActiveFilters = Boolean(
    filters.unread || filters.starred || filters.hasAttachment,
  );
  const splitScopeKey = activeSplit?.id ?? queryKeys.emails.baseScope;

  const emailsQuery = useInfiniteQuery({
    queryKey: queryKeys.emails.listScoped(view, mailboxId, splitScopeKey),
    queryFn: ({ pageParam }) =>
      fetchViewPage({
        view,
        mailboxId,
        cursor: pageParam || undefined,
        splitRule: activeSplit?.rules ?? null,
      }),
    initialPageParam: "" as string,
    ...(initialPage
      ? { initialData: { pages: [initialPage], pageParams: [""] } }
      : {}),
    getNextPageParam: (lastPage) => lastPage?.cursor ?? undefined,
    staleTime: 5_000,
    gcTime: 2 * 60_000,
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
        ? allEmails.filter((email) => matchesFilters(email, filters))
        : allEmails,
    [filters, hasActiveFilters, allEmails],
  );
  const threadGroups = useMemo(
    () => groupEmailsByThread(displayEmails),
    [displayEmails],
  );
  const hasEmails = threadGroups.length > 0;

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
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    loadMoreRef,
    filters,
    setFilters,
    hasActiveFilters,
  };
}
