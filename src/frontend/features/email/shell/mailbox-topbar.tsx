import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import type { SplitRule } from "@/db/schema";
import { FocusWindowToggle } from "@/features/email/focus-window/focus-window-toggle";
import { useMailCompose } from "@/features/email/mail/compose/compose-context";
import { fetchViewUnreadCounts } from "@/features/email/mail/data/unread-counts";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import {
  createMailboxSplitView,
  fetchSplitViews,
} from "@/features/email/split-views/queries";
import { splitViewQueryKeys } from "@/features/email/split-views/query-keys";
import { cn } from "@/lib/utils";
import { PlusIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MailboxSidebarTrigger } from "./mailbox-menu";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

const TABS = [
  { id: "triage", label: "Triage", to: "/$mailboxId/triage" as const },
  { id: "todo", label: "To do", to: "/$mailboxId/todo" as const },
  { id: "inbox", label: "Inbox", to: "/$mailboxId/inbox" as const },
];

const BASE_DOCUMENT_TITLE = "Duomo";

type TabId = (typeof TABS)[number]["id"];
type CreateViewPayload = { name: string; rules: SplitRule | null };
type ViewRuleForm = {
  senders: string;
  domains: string;
  recipients: string;
  subjectContains: string;
  hasAttachment: boolean;
  fromMailingList: boolean;
};

const EMPTY_RULE_FORM: ViewRuleForm = {
  senders: "",
  domains: "",
  recipients: "",
  subjectContains: "",
  hasAttachment: false,
  fromMailingList: false,
};

function parseRuleList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildSplitRule(form: ViewRuleForm): SplitRule | null {
  const senders = parseRuleList(form.senders);
  const domains = parseRuleList(form.domains);
  const recipients = parseRuleList(form.recipients);
  const subjectContains = parseRuleList(form.subjectContains);
  const rule: SplitRule = {};

  if (senders.length) rule.senders = senders;
  if (domains.length) rule.domains = domains;
  if (recipients.length) rule.recipients = recipients;
  if (subjectContains.length) rule.subjectContains = subjectContains;
  if (form.hasAttachment) rule.hasAttachment = true;
  if (form.fromMailingList) rule.fromMailingList = true;

  return Object.keys(rule).length > 0 ? rule : null;
}

function formatUnreadCount(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}

function useActiveTab(): TabId | null {
  return useRouterState({
    select: (state) => {
      const matches = state.matches;
      if (matches.some((m) => m.routeId === "/_dashboard/$mailboxId/triage"))
        return "triage";
      if (matches.some((m) => m.routeId === "/_dashboard/$mailboxId/todo"))
        return "todo";
      if (
        matches.some((m) =>
          m.routeId.startsWith("/_dashboard/$mailboxId/views"),
        )
      )
        return null;
      const inboxRoot = matches.some(
        (m) =>
          m.routeId.startsWith("/_dashboard/$mailboxId/inbox") ||
          m.routeId.startsWith("/_dashboard/$mailboxId/$folder"),
      );
      if (inboxRoot) return "inbox";
      return null;
    },
  });
}

export function MailboxTopbar() {
  const { mailboxId } = mailboxRoute.useParams();
  const activeTab = useActiveTab();
  const activeViewId = useRouterState({
    select: (state) => {
      const match = state.matches.find((m) =>
        m.routeId.startsWith("/_dashboard/$mailboxId/views"),
      );
      const params = match?.params;
      const viewId = params && "viewId" in params ? params.viewId : null;
      return typeof viewId === "string" ? viewId : null;
    },
  });
  const { openCompose } = useMailCompose();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [ruleForm, setRuleForm] = useState<ViewRuleForm>(EMPTY_RULE_FORM);

  const splitViewsQuery = useQuery({
    queryKey: splitViewQueryKeys.all(),
    queryFn: fetchSplitViews,
    staleTime: 60_000,
  });
  const viewCountsQuery = useQuery({
    queryKey: emailQueryKeys.viewCounts(mailboxId),
    queryFn: () => fetchViewUnreadCounts(mailboxId),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const viewCounts = viewCountsQuery.data;
  const pinnedViews = useMemo(
    () =>
      (splitViewsQuery.data ?? [])
        .filter((view) => view.visible && view.pinned && !view.isSystem)
        .sort((left, right) => left.position - right.position),
    [splitViewsQuery.data],
  );

  const createViewMutation = useMutation({
    mutationFn: (input: CreateViewPayload) =>
      createMailboxSplitView({
        mailboxId,
        name: input.name,
        rules: input.rules,
      }),
    onSuccess: async (view) => {
      setViewName("");
      setRuleForm(EMPTY_RULE_FORM);
      setCreateOpen(false);
      await queryClient.invalidateQueries({
        queryKey: splitViewQueryKeys.all(),
      });
      toast.success(`Created ${view.name}`);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to create view",
      );
    },
  });

  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const index = TABS.findIndex((t) => t.id === activeTab);
    const el = tabRefs.current[index];

    if (!el || !sliderRef.current) return;

    sliderRef.current.style.setProperty("--w", `${el.offsetWidth}px`);
    sliderRef.current.style.setProperty("--x", `${el.offsetLeft}px`);
  }, [
    activeTab,
    viewCounts?.inbox.messagesUnread,
    viewCounts?.todo.messagesUnread,
  ]);

  useEffect(() => {
    const unread = viewCounts?.inbox.messagesUnread ?? 0;
    document.title =
      unread > 0
        ? `(${formatUnreadCount(unread)}) ${BASE_DOCUMENT_TITLE}`
        : BASE_DOCUMENT_TITLE;

    return () => {
      document.title = BASE_DOCUMENT_TITLE;
    };
  }, [viewCounts?.inbox.messagesUnread]);

  return (
    <header className="flex shrink-0 items-center gap-1 border-b border-border/40 bg-background p-2">
      <div className="md:hidden">
        <MailboxSidebarTrigger />
      </div>

      <nav className="relative flex h-8 items-center" aria-label="Primary">
        <div
          ref={sliderRef}
          className="pointer-events-none absolute inset-y-0.5 left-0 bg-muted transition-[width,transform] duration-200 ease-out"
          style={{
            width: "var(--w)",
            transform: "translateX(var(--x))",
          }}
        />

        {TABS.map((tab, i) => {
          const unread =
            tab.id === "inbox"
              ? (viewCounts?.inbox.messagesUnread ?? 0)
              : tab.id === "todo"
                ? (viewCounts?.todo.messagesUnread ?? 0)
                : 0;
          return (
            <Link
              key={tab.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              to={tab.to}
              params={{ mailboxId }}
              preload="viewport"
              className={cn(
                "z-10 inline-flex h-7 items-center gap-1 px-3 text-center text-sm transition-all duration-150 ease-out hover:text-primary",
                activeTab == tab.id ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span>{tab.label}</span>
              {unread > 0 && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  ({formatUnreadCount(unread)})
                </span>
              )}
            </Link>
          );
        })}
        {pinnedViews.map((view) => (
          <Link
            key={view.id}
            to="/$mailboxId/views/$viewId"
            params={{ mailboxId, viewId: view.id }}
            preload="viewport"
            className={cn(
              "z-10 inline-flex h-7 max-w-34 items-center px-3 text-center text-sm transition-all duration-150 ease-out hover:text-primary",
              activeViewId === view.id
                ? "bg-muted text-primary"
                : "text-muted-foreground",
            )}
          >
            <span className="truncate">{view.name}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="z-10 ml-1 inline-flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Create view"
          title="Create view"
        >
          <PlusIcon className="size-3.5" />
        </button>
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <FocusWindowToggle />
        <Button
          variant={"secondary"}
          type="button"
          onClick={() => openCompose()}
        >
          New <Kbd className="bg-card">C</Kbd>
        </Button>
      </div>
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open && !createViewMutation.isPending) {
            setViewName("");
            setRuleForm(EMPTY_RULE_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              createViewMutation.mutate({
                name: viewName,
                rules: buildSplitRule(ruleForm),
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Create view</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={viewName}
                onChange={(event) => setViewName(event.target.value)}
                placeholder="Name"
                className="text-xs h-7 placeholder:text-xs"
                autoFocus
              />
              <div className="grid gap-2">
                <Input
                  value={ruleForm.senders}
                  onChange={(event) =>
                    setRuleForm((form) => ({
                      ...form,
                      senders: event.target.value,
                    }))
                  }
                  className="text-xs h-7 placeholder:text-xs"
                  placeholder="Sender contains"
                />
                <Input
                  value={ruleForm.domains}
                  onChange={(event) =>
                    setRuleForm((form) => ({
                      ...form,
                      domains: event.target.value,
                    }))
                  }
                  className="text-xs h-7 placeholder:text-xs"
                  placeholder="Domain"
                />
                <Input
                  value={ruleForm.recipients}
                  onChange={(event) =>
                    setRuleForm((form) => ({
                      ...form,
                      recipients: event.target.value,
                    }))
                  }
                  className="text-xs h-7 placeholder:text-xs"
                  placeholder="Recipient"
                />
                <Input
                  value={ruleForm.subjectContains}
                  onChange={(event) =>
                    setRuleForm((form) => ({
                      ...form,
                      subjectContains: event.target.value,
                    }))
                  }
                  className="text-xs h-7 placeholder:text-xs"
                  placeholder="Subject contains"
                />
              </div>
              <div className="grid gap-2 pt-1 text-xs">
                <label className="flex items-center gap-2 text-muted-foreground">
                  <Checkbox
                    checked={ruleForm.hasAttachment}
                    onCheckedChange={(checked) =>
                      setRuleForm((form) => ({
                        ...form,
                        hasAttachment: checked === true,
                      }))
                    }
                  />
                  <span>Has attachment</span>
                </label>
                <label className="flex items-center gap-2 text-muted-foreground">
                  <Checkbox
                    checked={ruleForm.fromMailingList}
                    onCheckedChange={(checked) =>
                      setRuleForm((form) => ({
                        ...form,
                        fromMailingList: checked === true,
                      }))
                    }
                  />
                  <span>From mailing list</span>
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setCreateOpen(false)}
                disabled={createViewMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!viewName.trim() || createViewMutation.isPending}
              >
                {createViewMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  );
}
