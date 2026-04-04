import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import type { EmailView } from "@/features/inbox/utils/inbox-filters";
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
  type Icon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export type MailSidebarItem =
  | EmailView
  | "drafts"
  | "search"
  | "filters"
  | "subscriptions";

type InboxSidebarShellProps = {
  mailboxId: number | null;
  activeItem: MailSidebarItem;
  children: ReactNode;
};

const primaryNavItems: Array<{
  key: MailSidebarItem;
  label: string;
  icon: Icon;
}> = [
  { key: "inbox", label: "Inbox", icon: TrayIcon },
  { key: "important", label: "Important", icon: FlagIcon },
  { key: "drafts", label: "Drafts", icon: FileDashedIcon },
  { key: "starred", label: "Starred", icon: StarIcon },
  { key: "sent", label: "Sent", icon: PaperPlaneTiltIcon },
  { key: "archived", label: "Archive", icon: ArchiveIcon },
  { key: "spam", label: "Spam", icon: WarningCircleIcon },
  { key: "trash", label: "Trash", icon: TrashIcon },
];

const secondaryNavItems: Array<{
  key: "search" | "subscriptions" | "filters";
  label: string;
  icon: Icon;
}> = [
  { key: "search", label: "Search", icon: MagnifyingGlassIcon },
  { key: "subscriptions", label: "Subscriptions", icon: NewspaperIcon },
  { key: "filters", label: "Filters", icon: FunnelIcon },
];

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
  mailboxId: number | null;
  className?: string;
}) {
  const { user } = useAuth();
  const accounts = useMailboxes().data?.accounts ?? [];
  const activeMailbox =
    mailboxId == null
      ? null
      : (accounts.find((account) => account.mailboxId === mailboxId) ?? null);
  const activeEmail =
    (activeMailbox ? getMailboxDisplayEmail(activeMailbox) : null) ??
    user?.email ??
    "All accounts";
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

function SidebarNav({
  activeItem,
  mailboxParam,
}: {
  activeItem: MailSidebarItem;
  mailboxParam: string;
}) {
  return (
    <SidebarMenu>
      {primaryNavItems.map((item) => {
        const Icon = item.icon;
        const isRootItem = item.key === "inbox" || item.key === "important";

        return (
          <SidebarMenuItem key={item.key}>
            <SidebarMenuButton asChild isActive={activeItem === item.key}>
              {item.key === "drafts" ? (
                <Link
                  to="/inbox/$id/drafts"
                  params={{ id: mailboxParam }}
                  activeOptions={{ exact: true }}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              ) : item.key === "starred" ? (
                <Link
                  to="/inbox/$id/starred"
                  params={{ id: mailboxParam }}
                  activeOptions={{ exact: true }}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              ) : item.key === "sent" ? (
                <Link
                  to="/inbox/$id/sent"
                  params={{ id: mailboxParam }}
                  activeOptions={{ exact: true }}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              ) : item.key === "archived" ? (
                <Link
                  to="/inbox/$id/archived"
                  params={{ id: mailboxParam }}
                  activeOptions={{ exact: true }}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              ) : item.key === "spam" ? (
                <Link
                  to="/inbox/$id/spam"
                  params={{ id: mailboxParam }}
                  activeOptions={{ exact: true }}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              ) : item.key === "trash" ? (
                <Link
                  to="/inbox/$id/trash"
                  params={{ id: mailboxParam }}
                  activeOptions={{ exact: true }}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <Link
                  to="/inbox/$id"
                  params={{ id: mailboxParam }}
                  activeOptions={{ exact: true, includeSearch: false }}
                  search={{
                    view: isRootItem && item.key === "important"
                      ? "important"
                      : undefined,
                    compose: undefined,
                  }}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}

      {secondaryNavItems.map((item) => {
        const Icon = item.icon;

        return (
          <SidebarMenuItem key={item.key}>
            <SidebarMenuButton asChild isActive={activeItem === item.key}>
              {item.key === "search" ? (
                <Link
                  to="/inbox/$id/search"
                  params={{ id: mailboxParam }}
                  activeOptions={{ exact: true }}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <Link
                  to={
                    item.key === "filters"
                      ? "/inbox/$id/filters"
                      : "/inbox/$id/subscriptions"
                  }
                  params={{ id: mailboxParam }}
                  activeOptions={{ exact: true }}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function InboxSidebarShell({
  mailboxId,
  activeItem,
  children,
}: InboxSidebarShellProps) {
  const mailboxParam = mailboxId != null ? String(mailboxId) : "all";
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      {isMobile ? (
        <Sidebar>
          <SidebarHeader className="gap-3 px-3 pt-5 pb-3">
            <InboxIdentity mailboxId={mailboxId} />
          </SidebarHeader>

          <SidebarContent className="px-2 pb-4">
            <SidebarNav
              activeItem={activeItem}
              mailboxParam={mailboxParam}
            />
          </SidebarContent>
        </Sidebar>
      ) : null}

      <div className="mx-auto flex w-full max-w-[64rem] min-w-0 gap-8 px-4 sm:px-6 lg:px-8">
        <aside className="sticky top-4 hidden w-56 shrink-0 self-start md:block">
          <div className="space-y-4 py-5">
            <InboxIdentity mailboxId={mailboxId} />
            <SidebarNav
              activeItem={activeItem}
              mailboxParam={mailboxParam}
            />
          </div>
        </aside>

        <main className="min-w-0 w-full max-w-3xl flex-1">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
