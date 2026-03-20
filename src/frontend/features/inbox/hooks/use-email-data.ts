import { fetchEmails } from "@/features/inbox/queries";
import type { EmailListItem, EmailListResponse } from "@/features/inbox/types";
import { buildThreadSections } from "@/features/inbox/utils/build-thread-sections";
import { groupEmailsByThread } from "@/features/inbox/utils/group-emails-by-thread";
import type { EmailView } from "@/features/inbox/utils/inbox-filters";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

const INBOX_POLL_INTERVAL_MS = 15_000;

export function useEmailData({
  view,
  initialEmails,
  selectedEmailId,
}: {
  view: EmailView;
  initialEmails: EmailListResponse;
  selectedEmailId: string | null;
}) {
  const emailsQuery = useInfiniteQuery({
    queryKey: ["emails", view],
    queryFn: async ({ pageParam }) =>
      fetchEmails({
        view: view === "drafts" ? "inbox" : view,
        limit: 60,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage?.pagination?.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
    initialData: {
      pages: [initialEmails],
      pageParams: [0],
    },
    enabled: view !== "drafts",
    refetchInterval: INBOX_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  const displayEmails = useMemo(
    () => emailsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [emailsQuery.data],
  );
  const threadGroups = useMemo(
    () => groupEmailsByThread(displayEmails),
    [displayEmails],
  );
  const displayRows = useMemo(
    () => threadGroups.map((group) => group.representative),
    [threadGroups],
  );
  const sections = useMemo(
    () => buildThreadSections(threadGroups),
    [threadGroups],
  );
  const emailById = useMemo(
    () => new Map(displayRows.map((email) => [email.id, email])),
    [displayRows],
  );
  const orderedIds = useMemo(
    () => threadGroups.map((group) => group.representative.id),
    [threadGroups],
  );
  const selectedEmail = useMemo<EmailListItem | null>(() => {
    if (!selectedEmailId) {
      return null;
    }

    return emailById.get(selectedEmailId) ?? null;
  }, [emailById, selectedEmailId]);

  const { hasNextPage, isFetching, isFetchingNextPage, fetchNextPage } =
    emailsQuery;
  const loadMoreRef = useIntersectionObserver<HTMLDivElement>({
    root: null,
    rootMargin: "200px 0px",
    threshold: 0.01,
    onChange: (isIntersecting) => {
      if (!isIntersecting || !hasNextPage || isFetchingNextPage || isFetching) {
        return;
      }

      void fetchNextPage();
    },
  });

  return {
    displayRows,
    sections,
    selectedEmail,
    orderedIds,
    emailById,
    emailsPending: emailsQuery.isPending,
    emailsError: emailsQuery.isError,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    loadMoreRef,
  };
}
