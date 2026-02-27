import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchEmails } from "@/features/emails/api";
import { formatInboxRowDate, groupEmailsByDay } from "@/features/emails/utils";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";

const orgRoute = getRouteApi("/_dashboard/$orgId");
const emailsRoute = getRouteApi("/_dashboard/$orgId/emails/");

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "primary", label: "Principal" },
  { key: "promotions", label: "Promotions" },
  { key: "social", label: "Social" },
  { key: "notifications", label: "Notifications" },
] as const;
type InboxFilterTab = (typeof FILTER_TABS)[number]["key"];

export default function EmailInboxPage() {
  const { orgId } = orgRoute.useLoaderData();
  const navigate = emailsRoute.useNavigate();
  const search = emailsRoute.useSearch();
  const selectedTab = (search.tab ?? "primary") as InboxFilterTab;
  const { initialEmails } = emailsRoute.useLoaderData();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const emailsQuery = useInfiniteQuery({
    queryKey: ["emails", orgId, selectedTab],
    queryFn: async ({ pageParam }) =>
      fetchEmails(orgId, {
        limit: 50,
        offset: pageParam,
        category:
          selectedTab === "all"
            ? undefined
            : (selectedTab as Exclude<InboxFilterTab, "all">),
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
  const totalEmails = emailsQuery.data?.pages[0]?.pagination.total ?? 0;
  const sections = useMemo(
    () => groupEmailsByDay(displayEmails),
    [displayEmails],
  );

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !emailsQuery.hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (emailsQuery.isFetchingNextPage || emailsQuery.isFetching) return;
        void emailsQuery.fetchNextPage();
      },
      { root: null, rootMargin: "200px 0px", threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [
    emailsQuery,
    emailsQuery.fetchNextPage,
    emailsQuery.hasNextPage,
    emailsQuery.isFetching,
    emailsQuery.isFetchingNextPage,
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {FILTER_TABS.map((tab) => (
            <Button
              key={tab.key}
              size="sm"
              variant={selectedTab === tab.key ? "secondary" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => {
                navigate({
                  search: { tab: tab.key },
                });
              }}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        {totalEmails > 0 && (
          <span className="text-xs font-mono text-muted-foreground">
            {totalEmails} emails
          </span>
        )}
      </div>

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
                <span className="text-sm font-mono text-muted-foreground">
                  {section.label}
                </span>
                <div className="space-y-1">
                  {section.items.map((email) => (
                    <div
                      key={email.id}
                      className="flex items-center justify-between gap-3 rounded-md p-1.5 hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        {!email.isRead && (
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-blue-500"
                            aria-label="Unread"
                            title="Unread"
                          />
                        )}
                        <span className="max-w-40 truncate font-medium">
                          {email.fromName || email.fromAddr}
                        </span>
                        {email.fromName && (
                          <span className="max-w-52 truncate text-muted-foreground">
                            {email.fromAddr}
                          </span>
                        )}
                        <span className="truncate text-muted-foreground">
                          {email.subject ?? "(no subject)"}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                        <span className="font-mono text-xs">
                          {formatInboxRowDate(email.date)}
                        </span>
                        {email.isCustomer && <span>★</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {emailsQuery.hasNextPage && (
              <div
                ref={loadMoreRef}
                className="pt-2 text-center text-muted-foreground"
              >
                {emailsQuery.isFetchingNextPage
                  ? "Loading more..."
                  : "Scroll for more"}
              </div>
            )}
          </div>
        ) : (
          <p className="p-4 text-center text-muted-foreground">
            No emails found.
          </p>
        )}
      </div>
    </div>
  );
}
