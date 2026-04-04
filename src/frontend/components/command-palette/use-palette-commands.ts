import { VIEW_VALUES, type EmailView } from "@/features/inbox/utils/inbox-filters";
import { useLogout } from "@/hooks/use-auth";
import { getMailboxDisplayEmail, useMailboxes } from "@/hooks/use-mailboxes";
import { useTheme } from "@/hooks/use-theme";
import { getActiveInboxId } from "@/lib/utils";
import {
  CheckSquareIcon,
  GearIcon,
  HouseSimpleIcon,
  AtIcon,
  MoonIcon,
  CalendarDotsIcon,
  SignOutIcon,
  SunIcon,
  TrayIcon,
} from "@phosphor-icons/react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import React, { useCallback, useMemo } from "react";
import type { PaletteCommand } from "./types";

function paletteIcon(Icon: React.ComponentType<{ className?: string }>) {
  return React.createElement(Icon, { className: "size-4" });
}

function buildNavigationCommands(
  runNavigation: (to: "/home" | "/tasks" | "/docs" | "/settings" | "/agenda") => void,
  navigateToInbox: () => void,
): PaletteCommand[] {
  return [
    { id: "home", label: "Home", icon: paletteIcon(HouseSimpleIcon), onSelect: () => runNavigation("/home") },
    { id: "inbox", label: "Inbox", icon: paletteIcon(TrayIcon), onSelect: navigateToInbox },
    { id: "tasks", label: "Tasks", icon: paletteIcon(CheckSquareIcon), onSelect: () => runNavigation("/tasks") },
    { id: "agenda", label: "Agenda", icon: paletteIcon(CalendarDotsIcon), onSelect: () => runNavigation("/agenda") },
    { id: "settings", label: "Settings", icon: paletteIcon(GearIcon), onSelect: () => runNavigation("/settings") },
  ];
}

function buildAccountCommands(
  isEmailsRoute: boolean,
  activeInboxId: string,
  currentMailboxView: EmailView | undefined,
  pathname: string,
  routeSearch: {
    q?: unknown;
    includeJunk?: unknown;
    context?: unknown;
  },
  accounts: Array<{ mailboxId: number | null; email: string | null; gmailEmail?: string | null }>,
  navigate: ReturnType<typeof useNavigate>,
  close: () => void,
): PaletteCommand[] {
  if (!isEmailsRoute) return [];

  return accounts
    .filter((account) => account.mailboxId != null)
    .map((account) => {
      const mailboxId = String(account.mailboxId);
      const label = getMailboxDisplayEmail(account) ?? "Account";
      return {
        id: `switch-mailbox-${mailboxId}`,
        label:
          mailboxId === activeInboxId
            ? `${label} (Current)`
            : `Switch to ${label}`,
        icon: paletteIcon(AtIcon),
        onSelect: () => {
          const currentContext =
            VIEW_VALUES.includes(routeSearch.context as EmailView)
              ? (routeSearch.context as EmailView)
              : currentMailboxView;

          if (pathname.endsWith("/drafts")) {
            navigate({
              to: "/inbox/$id/drafts",
              params: { id: mailboxId },
            });
          } else if (pathname.endsWith("/search")) {
            navigate({
              to: "/inbox/$id/search",
              params: { id: mailboxId },
              search: {
                q:
                  typeof routeSearch.q === "string" && routeSearch.q.trim()
                    ? routeSearch.q
                    : undefined,
                includeJunk:
                  routeSearch.includeJunk === true
                    ? true
                    : undefined,
              },
            });
          } else if (pathname.endsWith("/starred")) {
            navigate({
              to: "/inbox/$id/starred",
              params: { id: mailboxId },
            });
          } else if (pathname.endsWith("/sent")) {
            navigate({
              to: "/inbox/$id/sent",
              params: { id: mailboxId },
            });
          } else if (pathname.endsWith("/archived")) {
            navigate({
              to: "/inbox/$id/archived",
              params: { id: mailboxId },
            });
          } else if (pathname.endsWith("/spam")) {
            navigate({
              to: "/inbox/$id/spam",
              params: { id: mailboxId },
            });
          } else if (pathname.endsWith("/trash")) {
            navigate({
              to: "/inbox/$id/trash",
              params: { id: mailboxId },
            });
          } else if (pathname.includes("/email/") && currentContext === "sent") {
            navigate({
              to: "/inbox/$id/sent",
              params: { id: mailboxId },
            });
          } else if (pathname.includes("/email/") && currentContext === "starred") {
            navigate({
              to: "/inbox/$id/starred",
              params: { id: mailboxId },
            });
          } else if (pathname.includes("/email/") && currentContext === "archived") {
            navigate({
              to: "/inbox/$id/archived",
              params: { id: mailboxId },
            });
          } else if (pathname.includes("/email/") && currentContext === "spam") {
            navigate({
              to: "/inbox/$id/spam",
              params: { id: mailboxId },
            });
          } else if (pathname.includes("/email/") && currentContext === "trash") {
            navigate({
              to: "/inbox/$id/trash",
              params: { id: mailboxId },
            });
          } else {
            navigate({
              to: "/inbox/$id",
              params: { id: mailboxId },
              search: {
                view:
                  currentContext === "important"
                    ? "important"
                    : undefined,
                compose: undefined,
              },
            });
          }
          close();
        },
      } satisfies PaletteCommand;
    })
    .filter((command) => !command.label.endsWith("(Current)"));
}

function buildTaskViewCommands(
  isTasksRoute: boolean,
  navigate: ReturnType<typeof useNavigate>,
  close: () => void,
): PaletteCommand[] {
  if (!isTasksRoute) return [];

  return ([
    { view: "all", label: "All Tasks" },
    { view: "today", label: "Due Today" },
    { view: "upcoming", label: "Upcoming" },
  ] as const).map(({ view, label }) => ({
    id: `task-view-${view}`,
    label,
    icon: paletteIcon(CheckSquareIcon),
    onSelect: () => {
      navigate({
        to: "/tasks",
        search: (prev) => ({ ...prev, view: view === "all" ? undefined : view }),
      });
      close();
    },
  }));
}

function buildActionCommands(opts: {
  close: () => void;
  resolvedTheme: string | undefined;
  toggleTheme: () => void;
  logout: { mutate: () => void };
}): PaletteCommand[] {
  const { close, resolvedTheme, toggleTheme, logout } = opts;

  return [
    {
      id: "toggle-theme",
      label: resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
      icon: paletteIcon(resolvedTheme === "dark" ? SunIcon : MoonIcon),
      onSelect: () => { toggleTheme(); close(); },
    },
    {
      id: "sign-out",
      label: "Sign out",
      icon: paletteIcon(SignOutIcon),
      onSelect: () => { logout.mutate(); close(); },
    },
  ];
}

export function usePaletteCommands({
  close,
}: {
  close: () => void;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const logout = useLogout();
  const accounts = useMailboxes().data?.accounts ?? [];
  const { resolved: resolvedTheme, toggle: toggleTheme } = useTheme();

  const pathname = router.state.location.pathname;
  const activeInboxIdFromPath = getActiveInboxId(pathname);
  const firstMailboxId =
    accounts.find((account) => account.mailboxId != null)?.mailboxId ?? null;
  const defaultInboxId =
    activeInboxIdFromPath !== "all"
      ? activeInboxIdFromPath
      : firstMailboxId != null
        ? String(firstMailboxId)
        : "all";
  const isEmailsRoute = pathname === "/inbox/search" || pathname.startsWith("/inbox/");
  const isTasksRoute = pathname === "/tasks";
  const routeSearch = router.state.location.search as {
    view?: unknown;
    q?: unknown;
    includeJunk?: unknown;
    context?: unknown;
  };
  const currentMailboxView =
    VIEW_VALUES.includes(routeSearch.view as EmailView)
      ? (routeSearch.view as EmailView)
      : undefined;
  const currentInboxView =
    currentMailboxView === "important" ? "important" : undefined;

  const navigateToInbox = useCallback(() => {
    navigate({
      to: "/inbox/$id",
      params: { id: defaultInboxId },
      search: { view: currentInboxView },
    });
    close();
  }, [close, navigate, defaultInboxId, currentInboxView]);

  const runNavigation = useCallback(
    (to: "/home" | "/tasks" | "/docs" | "/settings" | "/agenda") => {
      navigate({ to });
      close();
    },
    [close, navigate],
  );

  const navigationCommands = useMemo(
    () => {
      const all = buildNavigationCommands(runNavigation, navigateToInbox);
      return all.filter((cmd) => {
        if (isEmailsRoute && cmd.id === "inbox") return false;
        if (isTasksRoute && cmd.id === "tasks") return false;
        return true;
      });
    },
    [runNavigation, navigateToInbox, isEmailsRoute, isTasksRoute],
  );

  const accountCommands = useMemo(
    () =>
      buildAccountCommands(
        isEmailsRoute,
        defaultInboxId,
        currentMailboxView,
        pathname,
        routeSearch,
        accounts,
        navigate,
        close,
      ),
    [
      isEmailsRoute,
      defaultInboxId,
      currentMailboxView,
      pathname,
      routeSearch,
      accounts,
      navigate,
      close,
    ],
  );

  const taskViewCommands = useMemo(
    () => buildTaskViewCommands(isTasksRoute, navigate, close),
    [isTasksRoute, navigate, close],
  );

  const actionCommands = useMemo(
    () => buildActionCommands({
      close,
      resolvedTheme, toggleTheme, logout,
    }),
    [close, resolvedTheme, toggleTheme, logout],
  );

  const agentSuggestions = useMemo(() => {
    if (pathname.startsWith("/inbox/")) {
      return [
        "Summarize what I'm looking at",
        "Draft a reply for the current email",
        "What should I follow up on here?",
      ];
    }
    if (pathname === "/tasks") {
      return [
        "What should I prioritize today?",
        "Show overdue tasks",
        "Create a follow-up task plan",
      ];
    }
    return [
      "What needs my attention today?",
      "Find emails I should reply to",
      "Create a task from my current context",
    ];
  }, [pathname]);

  return {
    visibleNavigationCommands: navigationCommands,
    accountCommands,
    taskNavigationCommands: taskViewCommands,
    actionCommands,
    agentSuggestions,
  };
}
