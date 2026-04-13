import { Kbd } from "@/components/ui/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useInboxCompose } from "@/features/email/inbox/components/compose/inbox-compose-provider";
import { LabelSidebarSection } from "@/features/email/labels/components/label-sidebar-section";
import { useSyncStatus } from "@/features/onboarding/hooks/use-sync-status";
import { useAuth } from "@/hooks/use-auth";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { getMailboxDisplayEmail, useMailboxes } from "@/hooks/use-mailboxes";
import {
  BellSimpleIcon,
  CheckIcon,
  ClockIcon,
  GearIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
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
import { type ReactNode, useMemo } from "react";

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
    <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <div className="flex size-5 items-center justify-center rounded-md border border-border bg-muted text-[10px] font-medium uppercase text-muted-foreground">
        {displayName.charAt(0)}
      </div>
      <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
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
  | "drafts"
  | "subscriptions";

function useActiveView(): NavView {
  return useRouterState({
    select: (state): NavView => {
      const matches = state.matches;
      const leaf = matches[matches.length - 1]?.routeId;
      if (leaf === "/_dashboard/$mailboxId/inbox/search") return "search";
      if (leaf === "/_dashboard/$mailboxId/inbox/drafts") return "drafts";
      if (leaf === "/_dashboard/$mailboxId/inbox/subscriptions") {
        return "subscriptions";
      }

      const label = matches.find(
        (match) =>
          match.routeId === "/_dashboard/$mailboxId/inbox/labels/$label/",
      )?.params.label;

      if (label === "important") return "important";

      const folder = matches.find(
        (match) => match.routeId === "/_dashboard/$mailboxId/$folder/",
      )?.params.folder;
      if (
        folder === "archived" ||
        folder === "sent" ||
        folder === "snoozed" ||
        folder === "starred" ||
        folder === "spam" ||
        folder === "trash"
      )
        return folder;

      return "inbox";
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
    case "subscriptions":
      return { to: "/$mailboxId/inbox/subscriptions", params: { mailboxId } };
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
  { view: "subscriptions", icon: BellSimpleIcon, label: "Subscriptions" },
] as const;

function InboxSidebar({ mailboxId }: { mailboxId: number }) {
  const activeView = useActiveView();
  const navigate = useNavigate();
  const { openCompose } = useInboxCompose();

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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <AccountHeader mailboxId={mailboxId} />
        <SidebarMenu className="group-data-[collapsible=icon]:hidden">
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => openCompose()}>
              <NotePencilIcon className="size-4 shrink-0" />
              <span>Compose</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() =>
                navigate({
                  to: "/$mailboxId/inbox/search",
                  params: { mailboxId },
                })
              }
            >
              <MagnifyingGlassIcon className="size-4 shrink-0" />
              <span>Search</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => navigate({ to: "/settings" })}>
              <GearIcon className="size-4 shrink-0" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item, i) => {
                const Icon = item.icon;
                const nav = getNavTo(item.view, mailboxId);
                return (
                  <SidebarMenuItem key={item.view} className="group/nav">
                    <SidebarMenuButton
                      asChild
                      isActive={activeView === item.view}
                      tooltip={item.label}
                    >
                      <Link
                        to={nav.to as string}
                        params={nav.params}
                        preload={item.view === "inbox" ? undefined : "intent"}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="group-data-[collapsible=icon]:hidden">
                          {item.label}
                        </span>
                        <Kbd className="ml-auto opacity-0 transition-opacity group-hover/nav:opacity-100 group-data-[collapsible=icon]:hidden">
                          ⌘{i + 1}
                        </Kbd>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <LabelSidebarSection mailboxId={mailboxId} />
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}

export function InboxSidebarShell({ children }: { children: ReactNode }) {
  const { mailboxId } = mailboxRoute.useParams();
  const { user } = useAuth();
  const syncStatus = useSyncStatus();
  const isSyncing = syncStatus.data?.state === "syncing";
  const isInitialSync = isSyncing && !syncStatus.data?.hasSynced;

  if (isInitialSync) {
    const firstName = user?.name?.split(" ")[0] ?? "";
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3">
        <p className="animate-pulse">
          Pulling your emails{firstName ? `, ${firstName}` : ""}...
        </p>
        <p className="text-sm text-muted-foreground ">
          This will take a second
        </p>
      </div>
    );
  }

  return (
    <SidebarProvider className="h-full min-h-0 flex-1 overflow-hidden">
      <InboxSidebar mailboxId={mailboxId} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto px-4">
        {children}
      </main>
    </SidebarProvider>
  );
}
