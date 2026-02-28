import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchEmailDetail,
  fetchEmails,
  type EmailListItem,
} from "@/features/emails/api";
import { EmailDetailDialog } from "@/features/emails/components/email-detail-dialog";
import { EmailDetailSheet } from "@/features/emails/components/email-detail-sheet";
import { formatInboxRowDate, groupEmailsByDay } from "@/features/emails/utils";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useIsMobile } from "@/hooks/use-mobile";
import { PaperclipIcon } from "@phosphor-icons/react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { useDebouncedCallback } from "use-debounce";

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

function getCategoryFromTab(tab: InboxFilterTab) {
  switch (tab) {
    case "all":
      return undefined;
    case "primary":
    case "promotions":
    case "social":
    case "notifications":
      return tab;
  }
}

function isInboxFilterTab(value: string): value is InboxFilterTab {
  return FILTER_TABS.some((tab) => tab.key === value);
}

export default function EmailInboxPage() {
  const { orgId } = orgRoute.useLoaderData();
  const navigate = emailsRoute.useNavigate();
  const search = emailsRoute.useSearch();
  const selectedTab = search.tab ?? "primary";
  const appliedSearch = search.q ?? "";
  const selectedEmailId = search.emailId ?? null;
  const { initialEmails } = emailsRoute.useLoaderData();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const prefetchEmail = useCallback(
    (emailId: string) => {
      void queryClient.prefetchQuery({
        queryKey: ["email-detail", orgId, emailId],
        queryFn: () => fetchEmailDetail(orgId, emailId, { skipLive: true }),
        staleTime: 60_000,
      });
    },
    [orgId, queryClient],
  );

  const updateSearchQuery = useDebouncedCallback((value: string) => {
    const nextQuery = value.trim();
    navigate({
      search: (prev) => ({
        ...prev,
        q: nextQuery.length > 0 ? nextQuery : undefined,
        emailId: undefined,
      }),
      replace: true,
    });
  }, 300);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        navigate({
          search: (prev) => ({
            ...prev,
            emailId: undefined,
          }),
          replace: true,
        });
      }
    },
    [navigate],
  );

  const emailsQuery = useInfiniteQuery({
    queryKey: ["emails", orgId, selectedTab, appliedSearch],
    queryFn: async ({ pageParam }) =>
      fetchEmails(orgId, {
        limit: 50,
        offset: pageParam,
        search: appliedSearch || undefined,
        category: getCategoryFromTab(selectedTab),
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
    <div className="mx-auto max-w-4xl space-y-7">
      <div className="flex items-center justify-between gap-2">
        <Select
          value={selectedTab}
          onValueChange={(value) => {
            if (!isInboxFilterTab(value)) return;
            navigate({
              search: (prev) => ({
                ...prev,
                tab: value,
                emailId: undefined,
              }),
            });
          }}
        >
          <SelectTrigger size="sm" className="">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            {FILTER_TABS.map((tab) => (
              <SelectItem key={tab.key} value={tab.key}>
                {tab.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          key={`email-search-${selectedTab}-${appliedSearch}`}
          placeholder="Search emails..."
          defaultValue={appliedSearch}
          className="h-7 text-sm"
          onChange={(e) => updateSearchQuery(e.target.value)}
        />
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
                <span className="text-xs font-mono text-muted-foreground">
                  {section.label}
                </span>
                <div className="space-y-1">
                  {section.items.map((email) => (
                    <div
                      key={email.id}
                      className="flex items-center justify-between gap-3 rounded-md p-1.5 hover:bg-muted/40 cursor-pointer"
                      onMouseEnter={() => prefetchEmail(email.id)}
                      onClick={() =>
                        navigate({
                          search: (prev) => ({
                            ...prev,
                            emailId: email.id,
                          }),
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
                        {email.isCustomer && <span>★</span>}
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
                    </div>
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
          orgId={orgId}
          email={selectedEmail}
          open={selectedEmail !== null}
          onOpenChange={handleOpenChange}
        />
      ) : (
        <EmailDetailDialog
          orgId={orgId}
          email={selectedEmail}
          open={selectedEmail !== null}
          onOpenChange={handleOpenChange}
        />
      )}
    </div>
  );
}
