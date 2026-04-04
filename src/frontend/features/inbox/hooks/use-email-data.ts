import { emailListInfiniteQueryOptions } from "@/features/inbox/queries";
import { buildThreadSections } from "@/features/inbox/utils/build-thread-sections";
import { groupEmailsByThread } from "@/features/inbox/utils/group-emails-by-thread";
import type { EmailView } from "@/features/inbox/utils/inbox-filters";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export function useEmailData({
  view,
  mailboxId,
}: {
  view: EmailView;
  mailboxId: number | null;
}) {
  const emailsQuery = useInfiniteQuery(
    emailListInfiniteQueryOptions({ view, mailboxId }),
  );

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
