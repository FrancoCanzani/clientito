import { Skeleton } from "@/components/ui/skeleton";
import { EmailDetailDialog } from "@/features/emails/components/email-detail-dialog";
import { EmailDetailSheet } from "@/features/emails/components/email-detail-sheet";
import { fetchEmailDetail } from "@/features/emails/queries/fetch-email-detail";
import { fetchEmails } from "@/features/emails/queries/fetch-emails";
import type { EmailListItem } from "@/features/emails/types";
import { formatInboxRowDate, groupEmailsByDay } from "@/features/emails/utils";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useIsMobile } from "@/hooks/use-mobile";
import { PaperclipIcon } from "@phosphor-icons/react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

const emailsRoute = getRouteApi("/_dashboard/emails");

export default function EmailInboxPage() {
  const navigate = emailsRoute.useNavigate();
  const search = emailsRoute.useSearch();
  const selectedEmailId = search.emailId ?? null;
  const { initialEmails } = emailsRoute.useLoaderData();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const prefetchEmail = useCallback(
    (emailId: string) => {
      void queryClient.prefetchQuery({
        queryKey: ["email-detail", emailId],
        queryFn: () => fetchEmailDetail(emailId),
        staleTime: 60_000,
      });
    },
    [queryClient],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        navigate({
          search: {
            ...search,
            emailId: undefined,
          },
          replace: true,
        });
      }
    },
    [navigate, search],
  );

  const emailsQuery = useInfiniteQuery({
    queryKey: ["emails", "inbox"],
    queryFn: async ({ pageParam }) =>
      fetchEmails({
        limit: 50,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
    initialData: {
      pages: [initialEmails],
      pageParams: [0],
    },
  });

  const displayEmails = useMemo(
    () => emailsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [emailsQuery.data],
  );
  const selectedEmail = useMemo<EmailListItem | null>(() => {
    if (!selectedEmailId) return null;
    return displayEmails.find((email) => email.id === selectedEmailId) ?? null;
  }, [displayEmails, selectedEmailId]);
  const sections = useMemo(
    () => groupEmailsByDay(displayEmails),
    [displayEmails],
  );

  const { hasNextPage, isFetching, isFetchingNextPage, fetchNextPage } =
    emailsQuery;
  const loadMoreRef = useIntersectionObserver<HTMLDivElement>({
    root: null,
    rootMargin: "200px 0px",
    threshold: 0.01,
    onChange: (isIntersecting) => {
      if (!isIntersecting) return;
      if (!hasNextPage) return;
      if (isFetchingNextPage || isFetching) return;
      void fetchNextPage();
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h2 className="text-lg font-medium">Inbox</h2>

      <div>
        {emailsQuery.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
        ) : displayEmails.length > 0 ? (
          <div className="space-y-6">
            {sections.map((section) => (
              <section
                key={section.label}
                className="flex flex-col gap-2 text-sm"
              >
                <span className="text-xs font-mono text-muted-foreground">
                  {section.label}
                </span>
                <div className="space-y-1">
                  {section.items.map((email) => (
                    <button
                      key={email.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-md p-1.5 text-left hover:bg-muted/40"
                      onMouseEnter={() => prefetchEmail(email.id)}
                      onFocus={() => prefetchEmail(email.id)}
                      onClick={() =>
                        navigate({
                          search: {
                            ...search,
                            emailId: email.id,
                          },
                          replace: true,
                        })
                      }
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        {!email.isRead && (
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-blue-500"
                            aria-label="Unread"
                            title="Unread"
                          />
                        )}
                        <span className="max-w-44 truncate font-medium">
                          {email.fromName || email.fromAddr}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {email.subject ?? "(no subject)"}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                        {email.hasAttachment && (
                          <span title="Has attachment">
                            <PaperclipIcon
                              className="size-3.5"
                              aria-label="Has attachment"
                            />
                          </span>
                        )}
                        <span className="font-mono text-xs">
                          {formatInboxRowDate(email.date)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
            {hasNextPage && (
              <div
                ref={loadMoreRef}
                className="pt-2 text-center text-xs text-muted-foreground"
              >
                {isFetchingNextPage ? "Loading more..." : "Scroll for more"}
              </div>
            )}
          </div>
        ) : (
          <p className="p-4 text-center text-muted-foreground">
            No emails found.
          </p>
        )}
      </div>

      {isMobile ? (
        <EmailDetailSheet
          email={selectedEmail}
          open={selectedEmail !== null}
          onOpenChange={handleOpenChange}
        />
      ) : (
        <EmailDetailDialog
          email={selectedEmail}
          open={selectedEmail !== null}
          onOpenChange={handleOpenChange}
        />
      )}
    </div>
  );
}
