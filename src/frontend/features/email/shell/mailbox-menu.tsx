import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { isInternalLabelName } from "@/features/email/labels/internal-labels";
import { fetchLabels } from "@/features/email/labels/queries";
import { labelQueryKeys } from "@/features/email/labels/query-keys";
import { beginGmailConnection } from "@/features/onboarding/mutations";
import { getMailboxDisplayEmail, useMailboxes } from "@/hooks/use-mailboxes";
import { shortcutKey } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import {
  ArchiveIcon,
  CheckIcon,
  FileDashedIcon,
  GearSixIcon,
  ListIcon,
  MagnifyingGlassIcon,
  PaperPlaneTiltIcon,
  PlusIcon,
  StarIcon,
  TagIcon,
  TrashIcon,
  TrayIcon,
  WarningIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  getRouteApi,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");
const sidebarShortcutIds: Record<string, string> = {
  Inbox: "nav:inbox",
  Search: "nav:search",
  Starred: "nav:starred",
  Done: "nav:archived",
  Sent: "nav:sent",
  Drafts: "nav:drafts",
  Spam: "nav:spam",
  Trash: "nav:trash",
};

const mailSidebarItems = [
  { label: "Inbox", icon: TrayIcon, to: "/$mailboxId/inbox" },
  {
    label: "Search",
    icon: MagnifyingGlassIcon,
    to: "/$mailboxId/inbox/search",
  },
  { label: "Starred", icon: StarIcon, folder: "starred" },
  { label: "Done", icon: ArchiveIcon, folder: "archived" },
  { label: "Sent", icon: PaperPlaneTiltIcon, folder: "sent" },
  { label: "Drafts", icon: FileDashedIcon, to: "/$mailboxId/inbox/drafts" },
  { label: "Spam", icon: WarningIcon, folder: "spam" },
  { label: "Trash", icon: TrashIcon, folder: "trash" },
] as const;

function getMailboxSwitchRoute(
  matches: ReturnType<typeof useRouterState>["matches"],
): {
  to: string;
  getParams: (mailboxId: number) => Record<string, unknown>;
} {
  if (
    matches.some((match) => match.routeId === "/_dashboard/$mailboxId/triage")
  ) {
    return {
      to: "/$mailboxId/triage",
      getParams: (mailboxId) => ({ mailboxId }),
    };
  }
  if (
    matches.some((match) => match.routeId === "/_dashboard/$mailboxId/todo")
  ) {
    return {
      to: "/$mailboxId/todo",
      getParams: (mailboxId) => ({ mailboxId }),
    };
  }
  if (
    matches.some(
      (match) => match.routeId === "/_dashboard/$mailboxId/inbox/drafts",
    )
  ) {
    return {
      to: "/$mailboxId/inbox/drafts",
      getParams: (mailboxId) => ({ mailboxId }),
    };
  }
  if (
    matches.some(
      (match) => match.routeId === "/_dashboard/$mailboxId/inbox/search",
    )
  ) {
    return {
      to: "/$mailboxId/inbox/search",
      getParams: (mailboxId) => ({ mailboxId }),
    };
  }

  const folder = matches.find(
    (match) =>
      match.routeId === "/_dashboard/$mailboxId/$folder/" ||
      match.routeId === "/_dashboard/$mailboxId/$folder/email/$emailId",
  )?.params.folder;

  if (typeof folder === "string") {
    return {
      to: "/$mailboxId/$folder",
      getParams: (mailboxId) => ({ mailboxId, folder }),
    };
  }

  return {
    to: "/$mailboxId/inbox",
    getParams: (mailboxId) => ({ mailboxId }),
  };
}

function useMailboxLabels(mailboxId: number) {
  const labelsQuery = useQuery({
    queryKey: labelQueryKeys.list(mailboxId),
    queryFn: () => fetchLabels(mailboxId),
    staleTime: 60_000,
  });

  return useMemo(() => {
    const collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return [...(labelsQuery.data ?? [])]
      .filter(
        (label) => label.type === "user" && !isInternalLabelName(label.name),
      )
      .sort((a, b) => collator.compare(a.name, b.name));
  }, [labelsQuery.data]);
}

function useMailboxRouteState() {
  return useRouterState({
    select: (state) => {
      const routeIds = state.matches.map((match) => match.routeId);
      const folder = state.matches.find(
        (match) =>
          match.routeId === "/_dashboard/$mailboxId/$folder/" ||
          match.routeId === "/_dashboard/$mailboxId/$folder/email/$emailId",
      )?.params.folder;
      const label = state.matches.find(
        (match) =>
          match.routeId === "/_dashboard/$mailboxId/inbox/labels/$label/" ||
          match.routeId ===
            "/_dashboard/$mailboxId/inbox/labels/$label/email/$emailId",
      )?.params.label;

      return {
        routeIds,
        folder: typeof folder === "string" ? folder : null,
        label: typeof label === "string" ? label : null,
      };
    },
  });
}

function SidebarSection({
  title,
  children,
  hoverOnly = false,
  hideTitle = false,
  expanded = false,
}: {
  title: string;
  children: ReactNode;
  hoverOnly?: boolean;
  hideTitle?: boolean;
  expanded?: boolean;
}) {
  return (
    <section
      className={cn(
        "px-2 py-1",
        hoverOnly && "hidden group-hover/sidebar:block",
        hoverOnly && expanded && "block",
      )}
    >
      {!hideTitle && (
        <div
          className={cn(
            "h-5 overflow-hidden px-2 text-xs font-medium opacity-0 transition-opacity duration-100 group-hover/sidebar:opacity-100",
            expanded && "opacity-100",
          )}
        >
          {title}
        </div>
      )}
      <div className="space-y-px">{children}</div>
    </section>
  );
}

function SidebarLabel({
  icon: IconComponent,
  label,
  count,
  expanded = false,
  shortcutKey,
}: {
  icon: Icon;
  label: string;
  count?: number;
  expanded?: boolean;
  shortcutKey?: string;
}) {
  return (
    <>
      <IconComponent className="size-3.5 shrink-0" />
      <span
        className={cn(
          "min-w-0 flex-1 truncate opacity-0 transition-opacity duration-100 group-hover/sidebar:opacity-100",
          expanded && "opacity-100",
        )}
      >
        {label}
      </span>
      {shortcutKey && (
        <Kbd
          className={cn(
            "hidden group-hover/sidebar:inline-flex",
            expanded && "inline-flex",
          )}
        >
          {shortcutKey}
        </Kbd>
      )}
      {count != null && count > 0 && (
        <span
          className={cn(
            "px-1 text-xs tabular-nums opacity-0 transition-opacity duration-100 group-hover/sidebar:opacity-100",
            expanded && "opacity-100",
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </>
  );
}

function MailboxSidebarContent({
  expanded = false,
  onNavigate,
}: {
  expanded?: boolean;
  onNavigate?: () => void;
}) {
  const { mailboxId } = mailboxRoute.useParams();
  const accounts = (useMailboxes().data?.accounts ?? []).filter(
    (account) => account.mailboxId != null,
  );
  const labels = useMailboxLabels(mailboxId);
  const routeState = useMailboxRouteState();
  const navigate = useNavigate();
  const switchRoute = useRouterState({
    select: (state) => getMailboxSwitchRoute(state.matches),
  });
  const activeRoute = routeState.routeIds.join(" ");
  const activeAccount = accounts.find(
    (account) => account.mailboxId === mailboxId,
  );
  const sortedAccounts = [
    ...(activeAccount ? [activeAccount] : []),
    ...accounts.filter(
      (account) => account.accountId !== activeAccount?.accountId,
    ),
  ];

  return (
    <>
      <div className="shrink-0 border-b border-border/40 p-2">
        <div className="space-y-px">
          {sortedAccounts.map((account) => {
            const email =
              getMailboxDisplayEmail(account) ?? account.email ?? "";
            const active = account.mailboxId === mailboxId;
            const initial = email.trim().charAt(0).toUpperCase() || "?";

            return (
              <button
                key={account.accountId}
                type="button"
                title={email}
                className={cn(
                  "flex h-8 w-full items-center gap-3 overflow-hidden px-2 text-xs transition-colors",
                  "hover:bg-muted",
                  active && "bg-muted",
                )}
                onClick={() => {
                  if (!active && account.mailboxId != null) {
                    void navigate({
                      to: switchRoute.to,
                      params: switchRoute.getParams(account.mailboxId),
                    });
                  }
                  onNavigate?.();
                }}
              >
                <span className="flex size-3.5 shrink-0 items-center justify-center bg-background text-left text-[8px] font-medium">
                  {initial}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-left opacity-0 transition-opacity duration-100 group-hover/sidebar:opacity-100",
                    expanded && "opacity-100",
                  )}
                >
                  {email}
                </span>
                {active && (
                  <CheckIcon
                    className={cn(
                      "size-3.5 opacity-0 transition-opacity duration-100 group-hover/sidebar:opacity-100",
                      expanded && "opacity-100",
                    )}
                  />
                )}
              </button>
            );
          })}
          <button
            type="button"
            title="Add account"
            className="flex h-8 w-full items-center gap-3 overflow-hidden px-2 text-left text-xs transition-colors hover:bg-muted"
            onClick={() => {
              void beginGmailConnection(`/${mailboxId}/settings`);
              onNavigate?.();
            }}
          >
            <SidebarLabel
              icon={PlusIcon}
              label="Add account"
              expanded={expanded}
            />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <SidebarSection title="Mail" hideTitle expanded={expanded}>
          {mailSidebarItems.map((item) => {
            const active =
              "folder" in item
                ? routeState.folder === item.folder
                : item.label === "Drafts"
                  ? activeRoute.includes("/_dashboard/$mailboxId/inbox/drafts")
                  : item.label === "Search"
                    ? activeRoute.includes(
                        "/_dashboard/$mailboxId/inbox/search",
                      )
                    : activeRoute.includes("/_dashboard/$mailboxId/inbox") &&
                      !activeRoute.includes(
                        "/_dashboard/$mailboxId/inbox/drafts",
                      ) &&
                      !activeRoute.includes(
                        "/_dashboard/$mailboxId/inbox/search",
                      ) &&
                      routeState.label == null;
            return "folder" in item ? (
              <Link
                key={item.label}
                to="/$mailboxId/$folder"
                params={{ mailboxId, folder: item.folder }}
                preload="viewport"
                title={item.label}
                className={cn(
                  "flex h-8 w-full items-center gap-3 overflow-hidden px-2 text-xs transition-colors",
                  "hover:bg-muted",
                  active && "bg-muted",
                )}
                onClick={onNavigate}
              >
                <SidebarLabel
                  icon={item.icon}
                  label={item.label}
                  expanded={expanded}
                  shortcutKey={shortcutKey(sidebarShortcutIds[item.label])}
                />
              </Link>
            ) : (
              <Link
                key={item.label}
                to={item.to}
                params={{ mailboxId }}
                preload="viewport"
                title={item.label}
                className={cn(
                  "flex h-8 w-full items-center gap-3 overflow-hidden px-2 text-xs transition-colors",
                  "hover:bg-muted",
                  active && "bg-muted",
                )}
                onClick={onNavigate}
              >
                <SidebarLabel
                  icon={item.icon}
                  label={item.label}
                  expanded={expanded}
                  shortcutKey={shortcutKey(sidebarShortcutIds[item.label])}
                />
              </Link>
            );
          })}
        </SidebarSection>

        {labels.length > 0 && (
          <SidebarSection title="Labels" hoverOnly expanded={expanded}>
            {labels.map((label) => {
              const active = routeState.label === label.gmailId;
              return (
                <Link
                  key={label.gmailId}
                  to="/$mailboxId/inbox/labels/$label"
                  params={{ mailboxId, label: label.gmailId }}
                  preload="viewport"
                  title={label.name}
                  className={cn(
                    "flex h-8 w-full items-center gap-3 overflow-hidden px-2 text-xs transition-colors",
                    "hover:bg-muted",
                    active && "bg-muted",
                  )}
                  onClick={onNavigate}
                >
                  <SidebarLabel
                    icon={TagIcon}
                    label={label.name}
                    count={label.messagesUnread}
                    expanded={expanded}
                  />
                </Link>
              );
            })}
          </SidebarSection>
        )}
      </div>

      <div className="shrink-0 border-t border-border/40 p-2">
        <Link
          to="/$mailboxId/settings"
          params={{ mailboxId }}
          preload="viewport"
          title="Settings"
          className={cn(
            "flex h-8 w-full items-center gap-3 overflow-hidden px-2 text-xs transition-colors",
            "hover:bg-muted",
            activeRoute.includes("/_dashboard/$mailboxId/settings") &&
              "bg-muted",
          )}
          onClick={onNavigate}
        >
          <SidebarLabel
            icon={GearSixIcon}
            label="Settings"
            expanded={expanded}
            shortcutKey={shortcutKey("nav:settings")}
          />
        </Link>
      </div>
    </>
  );
}

export function MailboxSidebar() {
  return (
    <aside className="group/sidebar relative hidden w-12 shrink-0 bg-background md:block">
      <div className="absolute inset-y-0 left-0 z-30 flex w-12 flex-col overflow-hidden border-r border-border/40 bg-background transition-[width,box-shadow] duration-150 ease-out group-hover/sidebar:w-64 group-hover/sidebar:shadow-lg">
        <MailboxSidebarContent />
      </div>
    </aside>
  );
}

export function MailboxSidebarTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        type="button"
        aria-label="Open mailbox sidebar"
        onClick={() => setOpen(true)}
      >
        <ListIcon className="size-4" />
      </Button>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-3/4 max-w-none p-0"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Mailbox sidebar</SheetTitle>
          <SheetDescription>
            Mailbox navigation and account switcher.
          </SheetDescription>
        </SheetHeader>
        <div className="group/sidebar flex h-full w-full flex-col bg-background">
          <MailboxSidebarContent expanded onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
