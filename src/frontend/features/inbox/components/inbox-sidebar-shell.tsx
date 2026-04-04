import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { getMailboxDisplayEmail, useMailboxes } from "@/hooks/use-mailboxes";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  ArchiveIcon,
  FileDashedIcon,
  FlagIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  NewspaperIcon,
  PaperPlaneTiltIcon,
  StarIcon,
  TrashIcon,
  TrayIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Link, getRouteApi, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId/inbox");

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

function InboxIdentity({
  mailboxId,
  className,
}: {
  mailboxId: number;
  className?: string;
}) {
  const { user } = useAuth();
  const accounts = useMailboxes().data?.accounts ?? [];
  const activeMailbox =
    accounts.find((account) => account.mailboxId === mailboxId) ?? null;
  const activeEmail =
    (activeMailbox ? getMailboxDisplayEmail(activeMailbox) : null) ??
    user?.email ??
    "Inbox";
  const displayName = formatDisplayName(user?.name, activeEmail);

  return (
    <div className={cn("min-w-0 px-2", className)}>
      <p className="truncate text-sm font-medium text-foreground">
        {displayName}
      </p>
      <p className="truncate text-xs text-muted-foreground">{activeEmail}</p>
    </div>
  );
}

function SidebarNav() {
  const { mailboxId } = mailboxRoute.useParams();
  const currentRouteId = useRouterState({
    select: (state) => state.matches[state.matches.length - 1]?.routeId,
  });
  const search = useRouterState({
    select: (state) =>
      state.location.search as {
        view?: unknown;
        context?: unknown;
      },
  });
  const activeView =
    currentRouteId === "/_dashboard/$mailboxId/inbox/drafts"
      ? "drafts"
      : currentRouteId === "/_dashboard/$mailboxId/inbox/starred" ||
          (currentRouteId === "/_dashboard/$mailboxId/inbox/email/$emailId" &&
            search.context === "starred")
        ? "starred"
        : currentRouteId === "/_dashboard/$mailboxId/inbox/sent" ||
            (currentRouteId === "/_dashboard/$mailboxId/inbox/email/$emailId" &&
              search.context === "sent")
          ? "sent"
          : currentRouteId === "/_dashboard/$mailboxId/inbox/archived" ||
              (currentRouteId === "/_dashboard/$mailboxId/inbox/email/$emailId" &&
                search.context === "archived")
            ? "archived"
            : currentRouteId === "/_dashboard/$mailboxId/inbox/spam" ||
                (currentRouteId === "/_dashboard/$mailboxId/inbox/email/$emailId" &&
                  search.context === "spam")
              ? "spam"
              : currentRouteId === "/_dashboard/$mailboxId/inbox/trash" ||
                  (currentRouteId === "/_dashboard/$mailboxId/inbox/email/$emailId" &&
                    search.context === "trash")
                ? "trash"
                : currentRouteId === "/_dashboard/$mailboxId/inbox/search"
                  ? "search"
                  : currentRouteId === "/_dashboard/$mailboxId/inbox/subscriptions"
                    ? "subscriptions"
                    : currentRouteId === "/_dashboard/$mailboxId/inbox/filters"
                      ? "filters"
                      : search.view === "important"
                        ? "important"
                        : "inbox";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={activeView === "inbox"}>
          <Link to="/$mailboxId/inbox" params={{ mailboxId }}>
            <TrayIcon />
            <span>Inbox</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={activeView === "important"}>
          <Link
            to="/$mailboxId/inbox"
            params={{ mailboxId }}
            search={{ view: "important" }}
          >
            <FlagIcon />
            <span>Important</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={activeView === "drafts"}>
          <Link to="/$mailboxId/inbox/drafts" params={{ mailboxId }}>
            <FileDashedIcon />
            <span>Drafts</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={activeView === "starred"}>
          <Link to="/$mailboxId/inbox/starred" params={{ mailboxId }}>
            <StarIcon />
            <span>Starred</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={activeView === "sent"}>
          <Link to="/$mailboxId/inbox/sent" params={{ mailboxId }}>
            <PaperPlaneTiltIcon />
            <span>Sent</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={activeView === "archived"}>
          <Link to="/$mailboxId/inbox/archived" params={{ mailboxId }}>
            <ArchiveIcon />
            <span>Archive</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={activeView === "spam"}>
          <Link to="/$mailboxId/inbox/spam" params={{ mailboxId }}>
            <WarningCircleIcon />
            <span>Spam</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={activeView === "trash"}>
          <Link to="/$mailboxId/inbox/trash" params={{ mailboxId }}>
            <TrashIcon />
            <span>Trash</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={activeView === "search"}>
          <Link to="/$mailboxId/inbox/search" params={{ mailboxId }}>
            <MagnifyingGlassIcon />
            <span>Search</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={activeView === "subscriptions"}>
          <Link to="/$mailboxId/inbox/subscriptions" params={{ mailboxId }}>
            <NewspaperIcon />
            <span>Subscriptions</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={activeView === "filters"}>
          <Link to="/$mailboxId/inbox/filters" params={{ mailboxId }}>
            <FunnelIcon />
            <span>Filters</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function InboxSidebarShell({
  children,
}: {
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const { mailboxId } = mailboxRoute.useParams();

  return (
    <SidebarProvider className="min-h-0">
      {isMobile && (
        <Sidebar>
          <SidebarHeader className="gap-3 px-3 pt-5 pb-3">
            <InboxIdentity mailboxId={mailboxId} />
          </SidebarHeader>

          <SidebarContent className="px-2 pb-4">
            <SidebarNav />
          </SidebarContent>
        </Sidebar>
      )}

      <div className="mx-auto flex max-w-5xl min-w-0 flex-1 gap-8 px-4">
        <aside className="sticky top-4 hidden w-56 shrink-0 self-start md:block">
          <div className="space-y-4 py-5">
            <InboxIdentity mailboxId={mailboxId} />
            <SidebarNav />
          </div>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </SidebarProvider>
  );
}
