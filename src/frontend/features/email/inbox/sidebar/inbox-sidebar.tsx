import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useGatekeeperPending } from "@/features/email/gatekeeper/queries";
import { useInboxCompose } from "@/features/email/inbox/components/compose/inbox-compose-provider";
import { fetchInboxUnreadCount } from "@/features/email/inbox/queries";
import { emailQueryKeys } from "@/features/email/inbox/query-keys";
import { LabelSidebarSection } from "@/features/email/labels/components/label-sidebar-section";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { CaretDownIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AccountSwitcher } from "./account-switcher";

const FEEDBACK_EMAIL = "francocanzani@gmail.com";

type NavView =
  | "search"
  | "starred"
  | "trash"
  | "spam"
  | "archived"
  | "sent"
  | "inbox"
  | "snoozed"
  | "important"
  | "drafts";

function useActiveSidebarState(): {
  activeView: NavView;
  activeLabelId?: string;
  isSearchRoute: boolean;
  isSettingsRoute: boolean;
  isScreenerRoute: boolean;
  isTriageRoute: boolean;
} {
  return useRouterState({
    select: (state) => {
      const matches = state.matches;
      const isSearchRoute = matches.some(
        (match) => match.routeId === "/_dashboard/$mailboxId/inbox/search",
      );
      const isSettingsRoute = matches.some(
        (match) => match.routeId === "/_dashboard/$mailboxId/settings",
      );
      const isScreenerRoute = matches.some(
        (match) => match.routeId === "/_dashboard/$mailboxId/screener",
      );
      const isTriageRoute = matches.some(
        (match) => match.routeId === "/_dashboard/$mailboxId/triage",
      );
      const isDraftsRoute = matches.some(
        (match) => match.routeId === "/_dashboard/$mailboxId/inbox/drafts",
      );

      const activeLabelId = matches.find(
        (match) =>
          match.routeId === "/_dashboard/$mailboxId/inbox/labels/$label/" ||
          match.routeId ===
            "/_dashboard/$mailboxId/inbox/labels/$label/email/$emailId",
      )?.params.label;

      if (isSearchRoute) {
        return {
          activeView: "search" as const,
          activeLabelId,
          isSearchRoute,
          isSettingsRoute,
          isScreenerRoute,
          isTriageRoute,
        };
      }

      if (isDraftsRoute) {
        return {
          activeView: "drafts" as const,
          activeLabelId,
          isSearchRoute,
          isSettingsRoute,
          isScreenerRoute,
          isTriageRoute,
        };
      }

      if (activeLabelId === "important") {
        return {
          activeView: "important" as const,
          activeLabelId,
          isSearchRoute,
          isSettingsRoute,
          isScreenerRoute,
          isTriageRoute,
        };
      }

      const folder = matches.find(
        (match) =>
          match.routeId === "/_dashboard/$mailboxId/$folder/" ||
          match.routeId === "/_dashboard/$mailboxId/$folder/email/$emailId",
      )?.params.folder;

      if (
        folder === "archived" ||
        folder === "sent" ||
        folder === "snoozed" ||
        folder === "starred" ||
        folder === "spam" ||
        folder === "trash"
      ) {
        return {
          activeView: folder,
          activeLabelId,
          isSearchRoute,
          isSettingsRoute,
          isScreenerRoute,
          isTriageRoute,
        };
      }

      return {
        activeView: "inbox" as const,
        activeLabelId,
        isSearchRoute,
        isSettingsRoute,
        isScreenerRoute,
        isTriageRoute,
      };
    },
  });
}

function getNavTo(
  view: string,
  mailboxId: number,
): { to: string; params: Record<string, unknown> } {
  switch (view) {
    case "archived":
    case "sent":
    case "snoozed":
    case "starred":
    case "spam":
    case "trash":
      return {
        to: "/$mailboxId/$folder",
        params: { mailboxId, folder: view },
      };
    case "search":
      return { to: "/$mailboxId/inbox/search", params: { mailboxId } };
    case "important":
      return {
        to: "/$mailboxId/inbox/labels/$label",
        params: { mailboxId, label: view },
      };
    case "drafts":
      return { to: "/$mailboxId/inbox/drafts", params: { mailboxId } };
    default:
      return { to: "/$mailboxId/inbox", params: { mailboxId } };
  }
}

const NAV_ITEMS = [
  { view: "inbox", label: "Inbox" },
  { view: "starred", label: "Starred" },
  { view: "archived", label: "Done" },
  { view: "sent", label: "Sent" },
  { view: "drafts", label: "Drafts" },
  { view: "snoozed", label: "Snoozed" },
  { view: "spam", label: "Spam" },
  { view: "trash", label: "Trash" },
] as const;

function formatSidebarCount(count: number): string {
  return count > 999 ? "999+" : String(count);
}

function getPageTitle({
  activeView,
  isSearchRoute,
  isSettingsRoute,
  isScreenerRoute,
  isTriageRoute,
}: {
  activeView: NavView;
  isSearchRoute: boolean;
  isSettingsRoute: boolean;
  isScreenerRoute: boolean;
  isTriageRoute: boolean;
}): string {
  if (isSearchRoute) return "Search";
  if (isSettingsRoute) return "Settings";
  if (isScreenerRoute) return "Screener";
  if (isTriageRoute) return "Triage";
  return NAV_ITEMS.find((item) => item.view === activeView)?.label ?? "Inbox";
}

export function InboxSidebar({ mailboxId }: { mailboxId: number }) {
  const {
    activeView,
    activeLabelId,
    isSearchRoute,
    isSettingsRoute,
    isScreenerRoute,
    isTriageRoute,
  } = useActiveSidebarState();
  const navigate = useNavigate();
  const mailboxAccounts = (useMailboxes().data?.accounts ?? []).filter(
    (account): account is typeof account & { mailboxId: number } =>
      account.mailboxId != null,
  );
  const { openCompose } = useInboxCompose();
  const [moreOpen, setMoreOpen] = useState(false);
  const screenerPendingQuery = useGatekeeperPending(mailboxId, true);
  const screenerPendingCount = screenerPendingQuery.data?.pendingCount ?? 0;
  const inboxUnreadCountQuery = useQuery({
    queryKey: emailQueryKeys.inboxUnreadCount(mailboxId),
    queryFn: () => fetchInboxUnreadCount(mailboxId),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const inboxUnreadCount = inboxUnreadCountQuery.data?.threadsUnread ?? 0;
  const pageTitle = getPageTitle({
    activeView,
    isSearchRoute,
    isSettingsRoute,
    isScreenerRoute,
    isTriageRoute,
  });

  useEffect(() => {
    document.title =
      inboxUnreadCount > 0
        ? `(${inboxUnreadCount}) ${pageTitle} - Duomo`
        : `${pageTitle} - Duomo`;

    return () => {
      document.title = "Duomo — A smaller inbox for Gmail.";
    };
  }, [inboxUnreadCount, pageTitle]);

  const hasStandaloneRouteSelection =
    isSearchRoute ||
    isSettingsRoute ||
    isScreenerRoute ||
    Boolean(activeLabelId && activeLabelId !== "important");

  const sentIndex = NAV_ITEMS.findIndex((item) => item.view === "sent");
  const primaryItems = NAV_ITEMS.slice(0, sentIndex + 1);
  const secondaryItems = NAV_ITEMS.slice(sentIndex + 1);
  const hasActiveSecondary = secondaryItems.some(
    (item) => item.view === activeView,
  );
  const showSecondary = moreOpen || hasActiveSecondary;

  const hotkeyBindings = useMemo(() => {
    const bindings: Record<string, () => void> = {};

    NAV_ITEMS.forEach((item, index) => {
      const nav = getNavTo(item.view, mailboxId);
      bindings[`$mod+${index + 1}`] = () =>
        navigate({ to: nav.to as string, params: nav.params });
    });

    if (mailboxAccounts.length > 1) {
      const currentIndex = mailboxAccounts.findIndex(
        (account) => account.mailboxId === mailboxId,
      );

      if (currentIndex !== -1) {
        bindings["$mod+shift+arrowdown"] = () => {
          const nextIndex = (currentIndex + 1) % mailboxAccounts.length;
          const nextAccount = mailboxAccounts[nextIndex];
          if (!nextAccount) return;
          navigate({
            to: "/$mailboxId/inbox",
            params: { mailboxId: nextAccount.mailboxId },
          });
        };

        bindings["$mod+shift+arrowup"] = () => {
          const prevIndex =
            (currentIndex - 1 + mailboxAccounts.length) % mailboxAccounts.length;
          const prevAccount = mailboxAccounts[prevIndex];
          if (!prevAccount) return;
          navigate({
            to: "/$mailboxId/inbox",
            params: { mailboxId: prevAccount.mailboxId },
          });
        };
      }
    }

    return bindings;
  }, [mailboxAccounts, mailboxId, navigate]);

  useHotkeys(hotkeyBindings, { allowInEditable: true });

  const renderNavItem = (
    item: (typeof NAV_ITEMS)[number],
    navIndex: number,
  ) => {
    const nav = getNavTo(item.view, mailboxId);
    const count = item.view === "inbox" ? inboxUnreadCount : 0;

    return (
      <SidebarMenuItem key={item.view} className="group/nav">
        <SidebarMenuButton
          asChild
          isActive={!hasStandaloneRouteSelection && activeView === item.view}
          tooltip={`${item.label} · ⌘${navIndex + 1}`}
        >
          <Link to={nav.to} params={nav.params} preload="viewport">
            <span className="min-w-0 truncate">{item.label}</span>
            {count > 0 && (
              <span className="ml-auto rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                {formatSidebarCount(count)}
              </span>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="border-none **:text-[13px] *:dark:bg-background">
      <SidebarHeader className="space-y-2">
        <AccountSwitcher mailboxId={mailboxId} />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="group text-sm"
              onClick={() => openCompose()}
              tooltip="Compose · C"
            >
              Compose
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-sm" asChild isActive={isSearchRoute}>
              <Link
                to="/$mailboxId/inbox/search"
                params={{ mailboxId }}
                preload="intent"
              >
                Search
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-sm" asChild isActive={isScreenerRoute}>
              <Link to="/$mailboxId/screener" params={{ mailboxId }} preload="intent">
                Screener
                {screenerPendingCount > 0 && (
                  <span className="ml-auto rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {screenerPendingCount}
                  </span>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-sm" asChild isActive={isTriageRoute}>
              <Link to="/$mailboxId/triage" params={{ mailboxId }} preload="intent">
                Triage
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Mail</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryItems.map((item, index) => renderNavItem(item, index))}
              {showSecondary &&
                secondaryItems.map((item, index) =>
                  renderNavItem(item, primaryItems.length + index),
                )}
              {!hasActiveSecondary && secondaryItems.length > 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setMoreOpen((prev) => !prev)}
                    aria-expanded={moreOpen}
                    aria-label={moreOpen ? "Show less" : "Show more"}
                    tooltip={moreOpen ? "Less" : "More"}
                    className="justify-center"
                  >
                    <CaretDownIcon
                      className={`size-2 shrink-0 text-foreground transition-transform ${
                        moreOpen ? "rotate-180" : ""
                      }`}
                    />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <LabelSidebarSection mailboxId={mailboxId} activeLabelId={activeLabelId} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-sm"
              onClick={() =>
                openCompose({
                  to: FEEDBACK_EMAIL,
                  subject: "Feedback",
                })
              }
            >
              Feedback
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
