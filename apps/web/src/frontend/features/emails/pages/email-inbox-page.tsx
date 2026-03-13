import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { markEmailRead } from "@/features/emails/api";
import {
  ComposeEmailDialog,
  type ComposeInitial,
} from "@/features/emails/components/compose-email-dialog";
import { EmailDetailContent } from "@/features/emails/components/email-detail-content";
import { fetchEmailDetail } from "@/features/emails/queries/fetch-email-detail";
import { fetchEmails } from "@/features/emails/queries/fetch-emails";
import type { EmailListItem } from "@/features/emails/types";
import {
  FILTER_TABS,
  VIEW_LABELS,
  VIEW_VALUES,
  type EmailView,
  type InboxFilterTab,
  isInboxFilterTab,
} from "@/features/emails/utils/inbox-filters";
import {
  formatInboxRowDate,
  groupEmailsByDay,
} from "@/features/emails/utils";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouteContext } from "@/hooks/use-page-context";
import {
  ArrowLeftIcon,
  CaretDownIcon,
  CaretUpIcon,
  PaperclipIcon,
} from "@phosphor-icons/react";
import { XIcon } from "lucide-react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

const emailsRoute = getRouteApi("/_dashboard/emails");

export default function EmailInboxPage() {
  const navigate = emailsRoute.useNavigate();
  const search = emailsRoute.useSearch();
  const selectedEmailId = search.id ?? null;
  const isComposing = search.compose === true;
  const currentView = (search.view ?? "inbox") as EmailView;
  const currentTab: InboxFilterTab =
    search.category && isInboxFilterTab(search.category)
      ? search.category
      : "all";
  const { initialEmails } = emailsRoute.useLoaderData();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [composeInitial, setComposeInitial] = useState<
    ComposeInitial | undefined
  >();
  const [forwardOpen, setForwardOpen] = useState(false);

  const currentCategory =
    currentView === "inbox" && currentTab !== "all" ? currentTab : undefined;
  const emailsQueryKey = ["emails", currentView, currentCategory ?? "all"];

  const prefetchEmail = (email: EmailListItem) => {
    void queryClient.prefetchQuery({
      queryKey: ["email-detail", email.id],
      queryFn: () => fetchEmailDetail(email.id),
      staleTime: 60_000,
    });

    if (email.hasAttachment) {
      void queryClient.prefetchQuery({
        queryKey: ["email-detail-live", email.id],
        queryFn: () => fetchEmailDetail(email.id, { refreshLive: true }),
        staleTime: 30_000,
      });
    }
  };

  const emailsQuery = useInfiniteQuery({
    queryKey: emailsQueryKey,
    queryFn: async ({ pageParam }) =>
      fetchEmails({
        view: currentView,
        category: currentCategory,
        limit: 50,
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

  useRouteContext(
    "/emails",
    selectedEmail
      ? {
          type: "email",
          id: selectedEmail.id,
          subject: selectedEmail.subject,
          fromName: selectedEmail.fromName,
          fromAddr: selectedEmail.fromAddr,
          threadId: selectedEmail.threadId,
        }
      : undefined,
  );

  const selectEmail = useCallback(
    (email: EmailListItem) => {
      navigate({
        search: { ...search, id: email.id, emailId: undefined },
        replace: true,
      });

      if (!email.isRead) {
        queryClient.setQueryData(
          emailsQueryKey,
          (old: typeof emailsQuery.data | undefined) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                data: page.data.map((e) =>
                  e.id === email.id ? { ...e, isRead: true } : e,
                ),
              })),
            };
          },
        );
        void markEmailRead(email.id);
      }
    },
    [emailsQueryKey, navigate, queryClient, search],
  );

  const selectedIndex = useMemo(() => {
    if (!selectedEmailId) return -1;
    return displayEmails.findIndex((e) => e.id === selectedEmailId);
  }, [displayEmails, selectedEmailId]);

  const goToEmail = useCallback(
    (direction: "prev" | "next") => {
      const nextIndex =
        direction === "next" ? selectedIndex + 1 : selectedIndex - 1;
      const email = displayEmails[nextIndex];
      if (email) selectEmail(email);
    },
    [displayEmails, selectEmail, selectedIndex],
  );

  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < displayEmails.length - 1;

  useEffect(() => {
    if (!search.emailId || search.id) return;
    navigate({
      search: {
        ...search,
        id: search.emailId,
        emailId: undefined,
      },
      replace: true,
    });
  }, [navigate, search]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "j" && hasNext) goToEmail("next");
      if (e.key === "k" && hasPrev) goToEmail("prev");
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [goToEmail, hasNext, hasPrev]);

  const closeDetail = useCallback(() => {
    navigate({
      search: { ...search, id: undefined, emailId: undefined },
      replace: true,
    });
  }, [navigate, search]);

  const handleForward = useCallback(
    (initial: ComposeInitial) => {
      closeDetail();
      setComposeInitial(initial);
      setForwardOpen(true);
    },
    [closeDetail],
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

  const emailListContent = (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <header className="shrink-0 space-y-3 p-4 pb-2">
        <h2 className="text-lg font-medium">{VIEW_LABELS[currentView]}</h2>
        <div className="flex flex-wrap gap-1.5">
          {VIEW_VALUES.map((view) => {
            const active = currentView === view;
            return (
              <Button
                key={view}
                type="button"
                variant={active ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  navigate({
                    search: {
                      ...search,
                      id: undefined,
                      emailId: undefined,
                      view,
                      category: view === "inbox" ? currentTab : undefined,
                    },
                    replace: true,
                  });
                }}
              >
                {VIEW_LABELS[view]}
              </Button>
            );
          })}
        </div>
        {currentView === "inbox" && (
          <div className="flex flex-wrap gap-1.5 border-l-2 border-muted pl-2">
            {FILTER_TABS.map((tab) => {
              const active = currentTab === tab.key;
              return (
                <Button
                  key={tab.key}
                  type="button"
                  variant={active ? "outline" : "ghost"}
                  size="sm"
                  onClick={() => {
                    navigate({
                      search: {
                        ...search,
                        id: undefined,
                        emailId: undefined,
                        category: tab.key,
                      },
                      replace: true,
                    });
                  }}
                >
                  {tab.label}
                </Button>
              );
            })}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {emailsQuery.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
        ) : emailsQuery.isError ? (
          <p className="p-4 text-center text-destructive">
            Failed to load emails.
          </p>
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
                <div className="space-y-0.5">
                  {section.items.map((email) => {
                    const isSelected = email.id === selectedEmailId;
                    return (
                      <button
                        key={email.id}
                        type="button"
                        className={`flex w-full items-center justify-between gap-3 rounded-md p-1.5 text-left text-sm transition-colors hover:bg-muted/40 ${
                          isSelected ? "bg-muted" : ""
                        }`}
                        onMouseEnter={() => prefetchEmail(email)}
                        onFocus={() => prefetchEmail(email)}
                        onClick={() => selectEmail(email)}
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
                    );
                  })}
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
    </div>
  );

  const emailDetailPanel = selectedEmail ? (
    <div className="flex h-full min-w-0 flex-col overflow-hidden border-l border-border">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">
            {selectedEmail.subject ?? "(no subject)"}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={!hasPrev}
            onClick={() => goToEmail("prev")}
            title="Previous (k)"
          >
            <CaretUpIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={!hasNext}
            onClick={() => goToEmail("next")}
            title="Next (j)"
          >
            <CaretDownIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={closeDetail}
            title="Close"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
        <EmailDetailContent
          key={selectedEmail.id}
          email={selectedEmail}
          onClose={closeDetail}
          onForward={handleForward}
        />
      </div>
    </div>
  ) : null;

  if (isMobile) {
    if (selectedEmail) {
      return (
        <div className="!mx-[-1rem] !max-w-none -mt-4 -mb-24 flex h-[100dvh] min-h-0 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={closeDetail}
            >
              <ArrowLeftIcon className="size-4" />
            </Button>
            <h3 className="min-w-0 flex-1 truncate text-sm font-medium">
              {selectedEmail.subject ?? "(no subject)"}
            </h3>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={!hasPrev}
                onClick={() => goToEmail("prev")}
              >
                <CaretUpIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={!hasNext}
                onClick={() => goToEmail("next")}
              >
                <CaretDownIcon className="size-4" />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <EmailDetailContent
              key={selectedEmail.id}
              email={selectedEmail}
              onClose={closeDetail}
              onForward={handleForward}
            />
          </div>
          {(isComposing || forwardOpen) && (
            <ComposeEmailDialog
              key={forwardOpen ? "forward-compose" : "new-compose"}
              open={isComposing || forwardOpen}
              initial={forwardOpen ? composeInitial : undefined}
              onOpenChange={(open) => {
                if (!open) {
                  setForwardOpen(false);
                  setComposeInitial(undefined);
                  if (isComposing) {
                    navigate({
                      search: { ...search, compose: undefined },
                      replace: true,
                    });
                  }
                }
              }}
            />
          )}
        </div>
      );
    }

    return (
      <div>
        {emailListContent}
        {(isComposing || forwardOpen) && (
          <ComposeEmailDialog
            key={forwardOpen ? "forward-compose" : "new-compose"}
            open={isComposing || forwardOpen}
            initial={forwardOpen ? composeInitial : undefined}
            onOpenChange={(open) => {
              if (!open) {
                setForwardOpen(false);
                setComposeInitial(undefined);
                if (isComposing) {
                  navigate({
                    search: { ...search, compose: undefined },
                    replace: true,
                  });
                }
              }
            }}
          />
        )}
      </div>
    );
  }

  const composeDialog = (isComposing || forwardOpen) && (
    <ComposeEmailDialog
      key={forwardOpen ? "forward-compose" : "new-compose"}
      open={isComposing || forwardOpen}
      initial={forwardOpen ? composeInitial : undefined}
      onOpenChange={(open) => {
        if (!open) {
          setForwardOpen(false);
          setComposeInitial(undefined);
          if (isComposing) {
            navigate({
              search: { ...search, compose: undefined },
              replace: true,
            });
          }
        }
      }}
    />
  );

  if (!selectedEmail) {
    return (
      <>
        {emailListContent}
        {composeDialog}
      </>
    );
  }

  return (
    <div className="!mx-[-1rem] !max-w-none -mt-4 -mb-24 h-[100dvh] min-w-0 overflow-hidden">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel
          defaultSize="40%"
          minSize="25%"
          maxSize="55%"
          className="min-w-0 overflow-hidden"
        >
          {emailListContent}
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel
          defaultSize="60%"
          minSize="35%"
          className="min-w-0 overflow-hidden"
        >
          {emailDetailPanel}
        </ResizablePanel>
      </ResizablePanelGroup>
      {composeDialog}
    </div>
  );
}
