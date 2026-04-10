import { EMAIL_LIST_PAGE_SIZE, fetchEmails } from "@/features/email/inbox/queries";
import type { EmailListResponse } from "@/features/email/inbox/types";
import { buildThreadSections } from "@/features/email/inbox/utils/build-thread-sections";
import { groupEmailsByThread } from "@/features/email/inbox/utils/group-emails-by-thread";
import type { EmailView } from "@/features/email/inbox/utils/inbox-filters";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export function useEmailData({
  view,
  mailboxId,
  initialPage,
}: {
  view: EmailView;
  mailboxId: number;
  initialPage?: EmailListResponse;
}) {
  const emailsQuery = useInfiniteQuery({
    queryKey: ["emails", view, mailboxId],
    queryFn: ({ pageParam }) =>
      fetchEmails({
        view,
        mailboxId,
        limit: EMAIL_LIST_PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    ...(initialPage
      ? {
          initialData: {
            pages: [initialPage],
            pageParams: [0],
          },
        }
      : {}),
    getNextPageParam: (lastPage) =>
      lastPage?.pagination?.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
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
  const sections = useMemo(
    () => buildThreadSections(threadGroups),
    [threadGroups],
  );
  const hasEmails = threadGroups.length > 0;

  const { hasNextPage, isFetching, isFetchingNextPage, fetchNextPage } = emailsQuery;

  const loadMoreRef = useIntersectionObserver<HTMLDivElement>({
    root: null,
    rootMargin: "200px 0px",
    threshold: 0.01,
    onChange: (isIntersecting) => {
      if (!isIntersecting || !hasNextPage || isFetchingNextPage || isFetching) {
        return;
      }
      fetchNextPage();
    },
  });

  return {
    view,
    mailboxId,
    hasEmails,
    sections,
    isError: emailsQuery.isError,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    loadMoreRef,
  };
}
