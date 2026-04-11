import { Kbd } from "@/components/ui/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { getMailboxDisplayEmail, useMailboxes } from "@/hooks/use-mailboxes";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  BellSimpleIcon,
  CheckIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  PencilSimpleLineIcon,
  PaperPlaneTiltIcon,
  StarIcon,
  TrayIcon,
} from "@phosphor-icons/react";
import {
  Link,
  getRouteApi,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

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

function SidebarNav({ mobile = false }: { mobile?: boolean }) {
  const { mailboxId } = mailboxRoute.useParams();
  const navigate = useNavigate();
  const activeView = useRouterState({
    select: (
      state,
    ):
      | "search"
      | "archived"
      | "sent"
      | "inbox"
      | "important"
      | "drafts"
      | "filters"
      | "subscriptions" => {
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
      if (label === "important") return "important";

      const folder = matches.find(
        (match) => match.routeId === "/_dashboard/$mailboxId/$folder/",
      )?.params.folder;
      if (folder === "archived" || folder === "sent") return folder;

      return "inbox";
    },
  });

  useHotkeys({
    "$mod+1": () =>
      navigate({
        to: "/$mailboxId/inbox",
        params: { mailboxId },
      }),
    "$mod+2": () =>
      navigate({
        to: "/$mailboxId/$folder",
        params: { mailboxId, folder: "archived" },
      }),
    "$mod+3": () =>
      navigate({
        to: "/$mailboxId/$folder",
        params: { mailboxId, folder: "sent" },
      }),
    "$mod+4": () =>
      navigate({
        to: "/$mailboxId/inbox/search",
        params: { mailboxId },
      }),
  });

  return (
    <>
      <SidebarMenu className="space-y-0.5">
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={activeView === "inbox"}>
            <Link to="/$mailboxId/inbox" params={{ mailboxId }}>
              <TrayIcon />
              <span>Inbox</span>
              <Kbd className="ml-auto shrink-0">⌘1</Kbd>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={activeView === "archived"}>
            <Link
              to="/$mailboxId/$folder"
              params={{ mailboxId, folder: "archived" }}
              preload="intent"
            >
              <CheckIcon />
              <span>Done</span>
              <Kbd className="ml-auto shrink-0">⌘2</Kbd>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={activeView === "sent"}>
            <Link
              to="/$mailboxId/$folder"
              preload="intent"
              params={{ mailboxId, folder: "sent" }}
            >
              <PaperPlaneTiltIcon />
              <span>Sent</span>
              <Kbd className="ml-auto shrink-0">⌘3</Kbd>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={activeView === "search"}>
            <Link
              to="/$mailboxId/inbox/search"
              preload="intent"
              params={{ mailboxId }}
            >
              <MagnifyingGlassIcon />
              <span>Search</span>
              <Kbd className="ml-auto shrink-0">⌘4</Kbd>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        {mobile && (
          <>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={activeView === "important"}>
                <Link
                  to="/$mailboxId/inbox/labels/$label"
                  preload="intent"
                  params={{ mailboxId, label: "important" }}
                >
                  <StarIcon />
                  <span>Important</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={activeView === "drafts"}>
                <Link
                  to="/$mailboxId/inbox/drafts"
                  preload="intent"
                  params={{ mailboxId }}
                >
                  <PencilSimpleLineIcon />
                  <span>Drafts</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={activeView === "filters"}>
                <Link
                  to="/$mailboxId/inbox/filters"
                  preload="intent"
                  params={{ mailboxId }}
                >
                  <FunnelSimpleIcon />
                  <span>Filters</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={activeView === "subscriptions"}
              >
                <Link
                  to="/$mailboxId/inbox/subscriptions"
                  preload="intent"
                  params={{ mailboxId }}
                >
                  <BellSimpleIcon />
                  <span>Subscriptions</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </>
        )}
      </SidebarMenu>
    </>
  );
}

function InboxShellContent({
  children,
  mailboxId,
}: {
  children: ReactNode;
  mailboxId: number;
}) {
  const { open, isMobile } = useSidebar();

  return (
    <div className="mx-auto flex max-w-5xl min-w-0 flex-1 gap-8 px-4">
      {open && (
        <aside className="sticky top-4 hidden w-56 shrink-0 self-start md:block">
          <div className="space-y-4 py-5">
            <InboxIdentity mailboxId={mailboxId} />
            <SidebarNav />
          </div>
        </aside>
      )}
      <main
        className={cn(
          "min-w-0 flex-1",
          !isMobile && !open && "flex justify-center",
        )}
      >
        {children}
      </main>
    </div>
  );
}

export function InboxSidebarShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { mailboxId } = mailboxRoute.useParams();

  return (
    <SidebarProvider className="min-h-0 flex-1" defaultOpen={false}>
      {isMobile && (
        <Sidebar>
          <SidebarHeader className="gap-3 px-3 pt-5 pb-3">
            <InboxIdentity mailboxId={mailboxId} />
          </SidebarHeader>

          <SidebarContent className="px-2 pb-4">
            <SidebarNav mobile />
          </SidebarContent>
        </Sidebar>
      )}

      <InboxShellContent mailboxId={mailboxId}>{children}</InboxShellContent>
    </SidebarProvider>
  );
}
