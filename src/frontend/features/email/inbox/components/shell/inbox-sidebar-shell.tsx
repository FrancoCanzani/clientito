import { Kbd } from "@/components/ui/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useInboxCompose } from "@/features/email/inbox/components/compose/inbox-compose-provider";
import { LabelSidebarSection } from "@/features/email/labels/components/label-sidebar-section";
import { useAuth } from "@/hooks/use-auth";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { getMailboxDisplayEmail, useMailboxes } from "@/hooks/use-mailboxes";
import {
  CaretDownIcon,
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

function AccountHeader({ mailboxId }: { mailboxId: number }) {
  const { user } = useAuth();
  const accounts = useMailboxes().data?.accounts ?? [];

  const activeMailbox = accounts.find((a) => a.mailboxId === mailboxId) ?? null;
  const activeEmail =
    (activeMailbox ? getMailboxDisplayEmail(activeMailbox) : null) ??
    user?.email ??
    "Inbox";
  const displayName = formatDisplayName(user?.name, activeEmail);

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{displayName}</span>
        <span className="truncate text-xs text-muted-foreground">
          {activeEmail}
        </span>
      </div>
    </div>
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
        };
      if (isDraftsRoute)
        return {
          activeView: "drafts" as const,
          activeLabelId,
          isSearchRoute,
          isSettingsRoute,
        };

      if (activeLabelId === "important")
        return {
          activeView: "important" as const,
          activeLabelId,
          isSearchRoute,
          isSettingsRoute,
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
        };

      return {
        activeView: "inbox" as const,
        activeLabelId,
        isSearchRoute,
        isSettingsRoute,
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
  { view: "snoozed", icon: ClockIcon, label: "Snoozed" },
  { view: "sent", icon: PaperPlaneTiltIcon, label: "Sent" },
  { view: "drafts", icon: PencilSimpleLineIcon, label: "Drafts" },
  { view: "archived", icon: CheckIcon, label: "Done" },
  { view: "spam", icon: WarningIcon, label: "Spam" },
  { view: "trash", icon: TrashIcon, label: "Trash" },
];

function InboxSidebar({ mailboxId }: { mailboxId: number }) {
  const { activeView, activeLabelId, isSearchRoute, isSettingsRoute } =
    useActiveSidebarState();
  const navigate = useNavigate();
  const { openCompose } = useInboxCompose();
  const [moreOpen, setMoreOpen] = useState(false);
  const hasStandaloneRouteSelection =
    isSearchRoute || isSettingsRoute || Boolean(activeLabelId);

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
    return bindings;
  }, [mailboxId, navigate]);

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
          className="text-base text-gray-600"
        >
          <Link
            to={nav.to as string}
            params={nav.params}
            preload={item.view === "inbox" ? undefined : "intent"}
          >
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
    <Sidebar className="*:bg-neutral-50/50 border-border/50">
      <SidebarHeader className="space-y-2">
        <AccountHeader mailboxId={mailboxId} />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-base text-gray-600 group"
              onClick={() => openCompose()}
            >
              Compose
              <Kbd className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
                ⌘C
              </Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-base text-gray-600"
              asChild
              isActive={isSearchRoute}
            >
              <Link to="/$mailboxId/inbox/search" params={{ mailboxId }}>
                Search
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-base text-gray-600"
              asChild
              isActive={isSettingsRoute}
            >
              <Link to="/$mailboxId/settings" params={{ mailboxId }}>
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
    </Sidebar>
  );
}

export function InboxSidebarShell({ children }: { children: ReactNode }) {
  const { mailboxId } = mailboxRoute.useParams();

  return (
    <SidebarProvider className="h-full min-h-0 flex-1 overflow-hidden">
      <InboxSidebar mailboxId={mailboxId} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        {children}
      </main>
    </SidebarProvider>
  );
}
