import { useLocalSyncSnapshot } from "@/hooks/use-local-sync";
import { EMAIL_LIST_PAGE_SIZE, fetchEmails } from "@/features/email/inbox/queries";
import type { EmailListResponse } from "@/features/email/inbox/types";
import { groupEmailsByThread } from "@/features/email/inbox/utils/group-emails-by-thread";
import { useAuth } from "@/hooks/use-auth";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { queryKeys } from "@/lib/query-keys";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

const LOAD_MORE_ROOT_MARGIN = "800px 0px";

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

  const emailsQuery = useInfiniteQuery({
    queryKey: queryKeys.emails.list(view, mailboxId),
    queryFn: ({ pageParam }) =>
      fetchEmails({
        view,
        mailboxId,
        limit: EMAIL_LIST_PAGE_SIZE,
        cursor: pageParam || undefined,
      }),
    initialPageParam: 0 as number,
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

  const loadMoreRef = useIntersectionObserver<HTMLDivElement>({
    root: null,
    rootMargin: LOAD_MORE_ROOT_MARGIN,
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
    threadGroups,
    isLoading: emailsQuery.isLoading,
    isError: emailsQuery.isError,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    isSyncing,
    isInitialSync,
    syncPulled: localSync.pulled,
    syncTotal: localSync.total,
    loadMoreRef,
  };
}
