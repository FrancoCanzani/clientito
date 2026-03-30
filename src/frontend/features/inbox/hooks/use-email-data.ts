import { fetchEmails } from "@/features/inbox/queries";
import { buildThreadSections } from "@/features/inbox/utils/build-thread-sections";
import { groupEmailsByThread } from "@/features/inbox/utils/group-emails-by-thread";
import type { EmailView } from "@/features/inbox/utils/inbox-filters";
import { parseMailboxId } from "@/lib/utils";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";

const INBOX_POLL_INTERVAL_MS = 15_000;
const emailsRoute = getRouteApi("/_dashboard/inbox/$id/");

export function useEmailData() {
  const search = emailsRoute.useSearch();
  const params = emailsRoute.useParams();

  const view: EmailView = search.view ?? "inbox";
  const mailboxId = parseMailboxId(params.id) ?? null;

  const emailsQuery = useInfiniteQuery({
    queryKey: ["emails", view, mailboxId ?? "all"],
    queryFn: async ({ pageParam }) =>
      fetchEmails({
        view,
        limit: 60,
        offset: pageParam,
        mailboxId: mailboxId ?? undefined,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage?.pagination?.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
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

  const { hasNextPage, isFetching, isFetchingNextPage, fetchNextPage } =
    emailsQuery;
  const loadMoreRef = useIntersectionObserver<HTMLDivElement>({
    root: null,
    rootMargin: "200px 0px",
    threshold: 0.01,
    onChange: (isIntersecting) => {
      if (!isIntersecting || !hasNextPage || isFetchingNextPage || isFetching)
        return;
      fetchNextPage();
    },
  });

  return {
    view,
    mailboxId,
    displayRows,
    sections,
    orderedIds,
    emailById,
    isError: emailsQuery.isError,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    loadMoreRef,
  };
}
