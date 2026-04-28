import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
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
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useGatekeeperPending } from "@/features/email/gatekeeper/queries";
import { useInboxCompose } from "@/features/email/inbox/components/compose/inbox-compose-provider";
import { LabelSidebarSection } from "@/features/email/labels/components/label-sidebar-section";
import { beginGmailConnection } from "@/features/onboarding/mutations";
import { useAuth } from "@/hooks/use-auth";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { getMailboxDisplayEmail, useMailboxes } from "@/hooks/use-mailboxes";
import {
  CaretDownIcon,
  CaretUpDownIcon,
  CheckIcon,
  ClockIcon,
  PaperPlaneTiltIcon,
  PencilSimpleLineIcon,
  StarIcon,
  TrashIcon,
  TrayIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import {
  Link,
  getRouteApi,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { type ReactNode, useMemo, useState } from "react";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");
const FEEDBACK_EMAIL = "rancocanzani@gmail.com";

function formatDisplayName(
  name: string | null | undefined,
  email: string | null,
) {
  const normalizedName = name?.trim();
  if (normalizedName) return normalizedName;

  const localPart = email
    ?.split("@")[0]
    ?.replace(/[._-]+/g, " ")
    ?.trim();
  if (!localPart) return "Inbox";

  return localPart.replace(/\b\w/g, (char) => char.toUpperCase());
}

function AccountSwitcher({ mailboxId }: { mailboxId: number }) {
  const { user } = useAuth();
  const accounts = (useMailboxes().data?.accounts ?? []).filter(
    (a) => a.mailboxId != null,
  );
  const navigate = useNavigate();

  const activeAccount = accounts.find((a) => a.mailboxId === mailboxId) ?? null;
  const activeEmail =
    (activeAccount ? getMailboxDisplayEmail(activeAccount) : null) ??
    user?.email ??
    "Inbox";
  const displayName = formatDisplayName(user?.name, activeEmail);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
        >
          <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{displayName}</span>
            <span className="truncate text-blue-900 dark:text-blue-50 text-xs">
              {activeEmail}
            </span>
          </div>
          <CaretUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {accounts.map((account) => {
          const email = getMailboxDisplayEmail(account) ?? account.email ?? "";
          const isActive = account.mailboxId === mailboxId;
          return (
            <DropdownMenuItem
              key={account.accountId}
              onSelect={() => {
                if (!isActive && account.mailboxId != null) {
                  void navigate({
                    to: "/$mailboxId/inbox",
                    params: { mailboxId: account.mailboxId },
                  });
                }
              }}
            >
              <span className="min-w-0 flex-1 truncate text-sm">{email}</span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void beginGmailConnection(`/${mailboxId}/settings`);
          }}
        >
          Add account
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/$mailboxId/settings" params={{ mailboxId }}>
            Settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
      const isDraftsRoute = matches.some(
        (match) => match.routeId === "/_dashboard/$mailboxId/inbox/drafts",
      );

      const activeLabelId = matches.find(
        (match) =>
          match.routeId === "/_dashboard/$mailboxId/inbox/labels/$label/" ||
          match.routeId ===
            "/_dashboard/$mailboxId/inbox/labels/$label/email/$emailId",
      )?.params.label;

      if (isSearchRoute)
        return {
          activeView: "search" as const,
          activeLabelId,
          isSearchRoute,
          isSettingsRoute,
          isScreenerRoute,
        };
      if (isDraftsRoute)
        return {
          activeView: "drafts" as const,
          activeLabelId,
          isSearchRoute,
          isSettingsRoute,
          isScreenerRoute,
        };

      if (activeLabelId === "important")
        return {
          activeView: "important" as const,
          activeLabelId,
          isSearchRoute,
          isSettingsRoute,
          isScreenerRoute,
        };

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
      )
        return {
          activeView: folder,
          activeLabelId,
          isSearchRoute,
          isSettingsRoute,
          isScreenerRoute,
        };

      return {
        activeView: "inbox" as const,
        activeLabelId,
        isSearchRoute,
        isSettingsRoute,
        isScreenerRoute,
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
  { view: "inbox", icon: TrayIcon, label: "Inbox" },
  { view: "starred", icon: StarIcon, label: "Starred" },
  { view: "archived", icon: CheckIcon, label: "Done" },
  { view: "sent", icon: PaperPlaneTiltIcon, label: "Sent" },
  { view: "drafts", icon: PencilSimpleLineIcon, label: "Drafts" },
  { view: "snoozed", icon: ClockIcon, label: "Snoozed" },
  { view: "spam", icon: WarningIcon, label: "Spam" },
  { view: "trash", icon: TrashIcon, label: "Trash" },
];

function InboxSidebar({ mailboxId }: { mailboxId: number }) {
  const {
    activeView,
    activeLabelId,
    isSearchRoute,
    isSettingsRoute,
    isScreenerRoute,
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
    NAV_ITEMS.forEach((item, i) => {
      const nav = getNavTo(item.view, mailboxId);
      bindings[`$mod+${i + 1}`] = () =>
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
            (currentIndex - 1 + mailboxAccounts.length) %
            mailboxAccounts.length;
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
    return (
      <SidebarMenuItem key={item.view} className="group/nav">
        <SidebarMenuButton
          asChild
          isActive={!hasStandaloneRouteSelection && activeView === item.view}
          tooltip={item.label}
          className="text-sm"
        >
          <Link to={nav.to} params={nav.params} preload="intent">
            {item.label}
            <Kbd className="ml-auto opacity-0 transition-opacity group-hover/nav:opacity-100">
              ⌘{navIndex + 1}
            </Kbd>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="border-none *:dark:bg-background">
      <SidebarHeader className="space-y-2">
        <AccountSwitcher mailboxId={mailboxId} />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-sm group"
              onClick={() => openCompose()}
            >
              Compose
              <Kbd className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
                C
              </Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-sm"
              asChild
              isActive={isSearchRoute}
            >
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
            <SidebarMenuButton
              className="text-sm"
              asChild
              isActive={isScreenerRoute}
            >
              <Link
                to="/$mailboxId/screener"
                params={{ mailboxId }}
                preload="intent"
              >
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
            <SidebarMenuButton
              className="text-sm"
              asChild
              isActive={isSettingsRoute}
            >
              <Link
                to="/$mailboxId/settings"
                params={{ mailboxId }}
                preload="intent"
              >
                Settings
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
              {primaryItems.map((item, i) => renderNavItem(item, i))}
              {showSecondary &&
                secondaryItems.map((item, i) =>
                  renderNavItem(item, primaryItems.length + i),
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
                      className={`size-2.5 shrink-0 text-foreground transition-transform ${
                        moreOpen ? "rotate-180" : ""
                      }`}
                    />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <LabelSidebarSection
          mailboxId={mailboxId}
          activeLabelId={activeLabelId}
        />
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

export function InboxSidebarShell({ children }: { children: ReactNode }) {
  const { mailboxId } = mailboxRoute.useParams();

  return (
    <SidebarProvider
      className="h-full overscroll-none
 min-h-0 flex-1 overflow-hidden"
    >
      <InboxSidebar mailboxId={mailboxId} />
      <main className="flex min-h-0 flex-1 overflow-hidden bg-sidebar dark:bg-background p-2">
        <div className="flex min-h-0 md:px-2 min-w-0 flex-1 flex-col overflow-hidden rounded bg-background">
          {children}
        </div>
      </main>
    </SidebarProvider>
  );
}
