import { fetchViewPage } from "@/features/email/inbox/queries";
import type { EmailListPage } from "@/features/email/inbox/types";
import { groupEmailsByThread } from "@/features/email/inbox/utils/group-emails-by-thread";
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

function isImportantEmail(email: {
  hasCalendar: boolean;
  aiCategory: string | null;
  isRead: boolean;
}): boolean {
  if (email.hasCalendar) return true;
  if (email.aiCategory === "action_required" || email.aiCategory === "invoice") {
    return true;
  }
  if (email.aiCategory === "notification" && !email.isRead) {
    return true;
  }
  return false;
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
  const autoPaginationEnabled = view !== "important";
  useEffect(() => {
    setFilters({});
  }, [view, mailboxId]);

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
  const scopedByView = useMemo(
    () =>
      view === "important" ? allEmails.filter((email) => isImportantEmail(email)) : allEmails,
    [allEmails, view],
  );
  const displayEmails = useMemo(
    () =>
      hasActiveFilters
        ? scopedByView.filter((email) => matchesFilters(email, filters))
        : scopedByView,
    [filters, hasActiveFilters, scopedByView],
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
      if (!autoPaginationEnabled) return;
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
    hasNextPage: autoPaginationEnabled ? (hasNextPage ?? false) : false,
    isFetchingNextPage,
    loadMoreRef,
    filters,
    setFilters,
    hasActiveFilters,
  };
}
