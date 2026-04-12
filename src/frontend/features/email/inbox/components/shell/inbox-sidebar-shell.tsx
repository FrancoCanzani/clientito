import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  SidebarRail,
} from "@/components/ui/sidebar";
import { useAuth, useLogout } from "@/hooks/use-auth";
import {
  type MailboxAccount,
  getMailboxDisplayEmail,
  useMailboxes,
} from "@/hooks/use-mailboxes";
import {
  ArrowBendUpLeftIcon,
  BellSimpleIcon,
  CaretRightIcon,
  CaretUpDownIcon,
  CheckIcon,
  ClockCounterClockwiseIcon,
  ClockIcon,
  CurrencyDollarIcon,
  FunnelSimpleIcon,
  InfoIcon,
  MegaphoneIcon,
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
import { Kbd } from "@/components/ui/kbd";
import { useHotkeys } from "@/hooks/use-hotkeys";

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

function AccountSwitcher({ mailboxId }: { mailboxId: number }) {
  const { user } = useAuth();
  const accounts = useMailboxes().data?.accounts ?? [];
  const logout = useLogout();
  const navigate = useNavigate();

  const activeMailbox = accounts.find((a) => a.mailboxId === mailboxId) ?? null;
  const activeEmail =
    (activeMailbox ? getMailboxDisplayEmail(activeMailbox) : null) ??
    user?.email ??
    "Inbox";
  const displayName = formatDisplayName(user?.name, activeEmail);

  const otherAccounts = accounts.filter(
    (a): a is MailboxAccount & { mailboxId: number } =>
      a.mailboxId !== null && a.mailboxId !== mailboxId,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center"
        >
          <div className="hidden size-5 items-center justify-center rounded-md border border-border bg-muted text-[10px] font-medium uppercase text-muted-foreground group-data-[collapsible=icon]:flex">
            {displayName.charAt(0)}
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-medium">{displayName}</span>
            <span className="truncate text-xs text-muted-foreground">
              {activeEmail}
            </span>
          </div>
          <CaretUpDownIcon className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        {otherAccounts.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Switch account
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {otherAccounts.map((account) => {
                const email = getMailboxDisplayEmail(account) ?? "Unknown";
                return (
                  <DropdownMenuItem
                    key={account.accountId}
                    onClick={() =>
                      navigate({
                        to: "/$mailboxId/inbox",
                        params: { mailboxId: account.mailboxId },
                      })
                    }
                  >
                    <span className="truncate">{email}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => navigate({ to: "/get-started" })}>
            Add account
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => logout.mutate()}>
          Sign out
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
  | "drafts"
  | "filters"
  | "subscriptions"
  | "to_respond"
  | "to_follow_up"
  | "fyi"
  | "notification"
  | "invoice"
  | "marketing";

const CATEGORY_LABELS = new Set([
  "to_respond",
  "to_follow_up",
  "fyi",
  "notification",
  "invoice",
  "marketing",
]);

function useActiveView(): NavView {
  return useRouterState({
    select: (state): NavView => {
      const matches = state.matches;
      const leaf = matches[matches.length - 1]?.routeId;
      if (leaf === "/_dashboard/$mailboxId/inbox/search") return "search";
      if (leaf === "/_dashboard/$mailboxId/inbox/drafts") return "drafts";
      if (leaf === "/_dashboard/$mailboxId/inbox/filters") return "filters";
      if (leaf === "/_dashboard/$mailboxId/inbox/subscriptions") {
        return "subscriptions";
      }

      const label = matches.find(
        (match) =>
          match.routeId === "/_dashboard/$mailboxId/inbox/labels/$label/",
      )?.params.label;

      if (label && CATEGORY_LABELS.has(label)) return label as NavView;

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
    case "to_respond":
    case "to_follow_up":
    case "fyi":
    case "notification":
    case "invoice":
    case "marketing":
      return {
        to: "/$mailboxId/inbox/labels/$label",
        params: { mailboxId, label: view },
      };
    case "drafts":
      return { to: "/$mailboxId/inbox/drafts", params: { mailboxId } };
    case "filters":
      return { to: "/$mailboxId/inbox/filters", params: { mailboxId } };
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
  { view: "filters", icon: FunnelSimpleIcon, label: "Filters" },
  { view: "subscriptions", icon: BellSimpleIcon, label: "Subscriptions" },
] as const;

const LABEL_ITEMS = [
  { view: "to_respond", icon: ArrowBendUpLeftIcon, label: "To respond" },
  {
    view: "to_follow_up",
    icon: ClockCounterClockwiseIcon,
    label: "To follow up",
  },
  { view: "fyi", icon: InfoIcon, label: "FYI" },
  { view: "notification", icon: BellSimpleIcon, label: "Notification" },
  { view: "invoice", icon: CurrencyDollarIcon, label: "Invoice" },
  { view: "marketing", icon: MegaphoneIcon, label: "Marketing" },
] as const;

function InboxSidebar({ mailboxId }: { mailboxId: number }) {
  const activeView = useActiveView();
  const navigate = useNavigate();
  const [labelsOpen, setLabelsOpen] = useState(true);

  const hotkeyBindings = useMemo(() => {
    const bindings: Record<string, () => void> = {};
    NAV_ITEMS.forEach((item, i) => {
      const nav = getNavTo(item.view, mailboxId);
      bindings[`$mod+${i + 1}`] = () =>
        navigate({ to: nav.to as string, params: nav.params });
    });
    const shiftKeys = ["!", "@", "#", "$", "%", "^"];
    LABEL_ITEMS.forEach((item, i) => {
      const nav = getNavTo(item.view, mailboxId);
      if (i < shiftKeys.length) {
        bindings[shiftKeys[i]] = () =>
          navigate({ to: nav.to as string, params: nav.params });
      }
    });
    return bindings;
  }, [mailboxId, navigate]);

  useHotkeys(hotkeyBindings, { allowInEditable: true });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <AccountSwitcher mailboxId={mailboxId} />
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
                        <Icon className="hidden group-data-[collapsible=icon]:block" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
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

        <Collapsible open={labelsOpen} onOpenChange={setLabelsOpen}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                Labels
                <CaretRightIcon
                  className="size-3! transition-transform duration-200"
                  style={{
                    transform: labelsOpen ? "rotate(90deg)" : undefined,
                  }}
                />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {LABEL_ITEMS.map((item, i) => {
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
                            preload="intent"
                          >
                            <Icon className="hidden group-data-[collapsible=icon]:block" />
                            <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                            <Kbd className="ml-auto opacity-0 transition-opacity group-hover/nav:opacity-100 group-data-[collapsible=icon]:hidden">
                              ⇧{i + 1}
                            </Kbd>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}

export function InboxSidebarShell({ children }: { children: ReactNode }) {
  const { mailboxId } = mailboxRoute.useParams();

  return (
    <SidebarProvider className="min-h-0 flex-1">
      <InboxSidebar mailboxId={mailboxId} />
      <main className="min-w-0 flex-1 px-4">{children}</main>
    </SidebarProvider>
  );
}
