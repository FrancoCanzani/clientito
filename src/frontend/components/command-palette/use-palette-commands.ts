import { VIEW_VALUES, type EmailView } from "@/features/inbox/utils/inbox-filters";
import { useLogout } from "@/hooks/use-auth";
import { getMailboxDisplayEmail, useMailboxes } from "@/hooks/use-mailboxes";
import { useTheme } from "@/hooks/use-theme";
import { getPreferredMailboxId } from "@/features/inbox/utils/mailbox";
import {
  AtIcon,
  CalendarDotsIcon,
  CheckSquareIcon,
  GearIcon,
  HouseSimpleIcon,
  MoonIcon,
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
  runNavigation: (target: "home" | "tasks" | "docs" | "settings" | "agenda") => void,
  navigateToInbox: () => void,
): PaletteCommand[] {
  return [
    {
      id: "home",
      label: "Home",
      icon: paletteIcon(HouseSimpleIcon),
      onSelect: () => runNavigation("home"),
    },
    {
      id: "inbox",
      label: "Inbox",
      icon: paletteIcon(TrayIcon),
      onSelect: navigateToInbox,
    },
    {
      id: "tasks",
      label: "Tasks",
      icon: paletteIcon(CheckSquareIcon),
      onSelect: () => runNavigation("tasks"),
    },
    {
      id: "agenda",
      label: "Agenda",
      icon: paletteIcon(CalendarDotsIcon),
      onSelect: () => runNavigation("agenda"),
    },
    {
      id: "settings",
      label: "Settings",
      icon: paletteIcon(GearIcon),
      onSelect: () => runNavigation("settings"),
    },
  ];
}

function buildAccountCommands(
  activeMailboxId: number,
  currentMailboxView: EmailView | undefined,
  currentRouteId: string | undefined,
  routeSearch: {
    q?: unknown;
    includeJunk?: unknown;
    context?: unknown;
  },
  accounts: Array<{
    mailboxId: number | null;
    email: string | null;
    gmailEmail?: string | null;
  }>,
  navigate: ReturnType<typeof useNavigate>,
  close: () => void,
): PaletteCommand[] {
  return accounts
    .filter(
      (account): account is typeof account & { mailboxId: number } =>
        account.mailboxId != null,
    )
    .filter((account) => account.mailboxId !== activeMailboxId)
    .map((account) => {
      const mailboxId = account.mailboxId;
      const label = getMailboxDisplayEmail(account) ?? "Account";

      return {
        id: `switch-mailbox-${mailboxId}`,
        label: `Switch to ${label}`,
        icon: paletteIcon(AtIcon),
        onSelect: () => {
          const currentContext =
            VIEW_VALUES.includes(routeSearch.context as EmailView)
              ? (routeSearch.context as EmailView)
              : currentMailboxView;

          if (currentRouteId === "/_dashboard/$mailboxId/home") {
            navigate({
              to: "/$mailboxId/home",
              params: { mailboxId },
            });
          } else if (currentRouteId === "/_dashboard/$mailboxId/agenda") {
            navigate({
              to: "/$mailboxId/agenda",
              params: { mailboxId },
            });
          } else if (currentRouteId === "/_dashboard/$mailboxId/tasks") {
            navigate({
              to: "/$mailboxId/tasks",
              params: { mailboxId },
            });
          } else if (currentRouteId === "/_dashboard/$mailboxId/inbox/drafts") {
            navigate({
              to: "/$mailboxId/inbox/drafts",
              params: { mailboxId },
            });
          } else if (currentRouteId === "/_dashboard/$mailboxId/inbox/search") {
            navigate({
              to: "/$mailboxId/inbox/search",
              params: { mailboxId },
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
          } else if (currentRouteId === "/_dashboard/$mailboxId/inbox/starred") {
            navigate({
              to: "/$mailboxId/inbox/starred",
              params: { mailboxId },
            });
          } else if (currentRouteId === "/_dashboard/$mailboxId/inbox/sent") {
            navigate({
              to: "/$mailboxId/inbox/sent",
              params: { mailboxId },
            });
          } else if (currentRouteId === "/_dashboard/$mailboxId/inbox/archived") {
            navigate({
              to: "/$mailboxId/inbox/archived",
              params: { mailboxId },
            });
          } else if (currentRouteId === "/_dashboard/$mailboxId/inbox/spam") {
            navigate({
              to: "/$mailboxId/inbox/spam",
              params: { mailboxId },
            });
          } else if (currentRouteId === "/_dashboard/$mailboxId/inbox/trash") {
            navigate({
              to: "/$mailboxId/inbox/trash",
              params: { mailboxId },
            });
          } else if (
            currentRouteId === "/_dashboard/$mailboxId/inbox/subscriptions"
          ) {
            navigate({
              to: "/$mailboxId/inbox/subscriptions",
              params: { mailboxId },
            });
          } else if (currentRouteId === "/_dashboard/$mailboxId/inbox/filters") {
            navigate({
              to: "/$mailboxId/inbox/filters",
              params: { mailboxId },
            });
          } else if (
            currentRouteId === "/_dashboard/$mailboxId/inbox/email/$emailId" &&
            currentContext === "sent"
          ) {
            navigate({
              to: "/$mailboxId/inbox/sent",
              params: { mailboxId },
            });
          } else if (
            currentRouteId === "/_dashboard/$mailboxId/inbox/email/$emailId" &&
            currentContext === "starred"
          ) {
            navigate({
              to: "/$mailboxId/inbox/starred",
              params: { mailboxId },
            });
          } else if (
            currentRouteId === "/_dashboard/$mailboxId/inbox/email/$emailId" &&
            currentContext === "archived"
          ) {
            navigate({
              to: "/$mailboxId/inbox/archived",
              params: { mailboxId },
            });
          } else if (
            currentRouteId === "/_dashboard/$mailboxId/inbox/email/$emailId" &&
            currentContext === "spam"
          ) {
            navigate({
              to: "/$mailboxId/inbox/spam",
              params: { mailboxId },
            });
          } else if (
            currentRouteId === "/_dashboard/$mailboxId/inbox/email/$emailId" &&
            currentContext === "trash"
          ) {
            navigate({
              to: "/$mailboxId/inbox/trash",
              params: { mailboxId },
            });
          } else {
            navigate({
              to: "/$mailboxId/inbox",
              params: { mailboxId },
              search: {
                view:
                  currentContext === "important"
                    ? "important"
                    : undefined,
              },
            });
          }

          close();
        },
      } satisfies PaletteCommand;
    });
}

function buildTaskViewCommands(
  isTasksRoute: boolean,
  mailboxId: number | null,
  navigate: ReturnType<typeof useNavigate>,
  close: () => void,
): PaletteCommand[] {
  if (!isTasksRoute || mailboxId == null) return [];

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
        to: "/$mailboxId/tasks",
        params: { mailboxId },
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
      label:
        resolvedTheme === "dark"
          ? "Switch to Light Mode"
          : "Switch to Dark Mode",
      icon: paletteIcon(resolvedTheme === "dark" ? SunIcon : MoonIcon),
      onSelect: () => {
        toggleTheme();
        close();
      },
    },
    {
      id: "sign-out",
      label: "Sign out",
      icon: paletteIcon(SignOutIcon),
      onSelect: () => {
        logout.mutate();
        close();
      },
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

  const matches = router.state.matches;
  const currentRouteId = matches[matches.length - 1]?.routeId;
  const activeMailboxParam = matches.find(
    (match) => match.routeId === "/_dashboard/$mailboxId",
  )?.params.mailboxId;
  const activeMailboxId = activeMailboxParam != null ? Number(activeMailboxParam) : null;
  const defaultMailboxId = activeMailboxId ?? getPreferredMailboxId(accounts);
  const isMailboxRoute = activeMailboxId != null;
  const isEmailsRoute = matches.some((match) =>
    match.routeId.startsWith("/_dashboard/$mailboxId/inbox"),
  );
  const isTasksRoute = currentRouteId === "/_dashboard/$mailboxId/tasks";
  const isHomeRoute = currentRouteId === "/_dashboard/$mailboxId/home";
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
    if (defaultMailboxId == null) {
      navigate({ to: "/get-started" });
      close();
      return;
    }

    navigate({
      to: "/$mailboxId/inbox",
      params: { mailboxId: defaultMailboxId },
      search: { view: currentInboxView },
    });
    close();
  }, [close, currentInboxView, defaultMailboxId, navigate]);

  const runNavigation = useCallback(
    (target: "home" | "tasks" | "docs" | "settings" | "agenda") => {
      if (target === "tasks") {
        if (defaultMailboxId != null) {
          navigate({
            to: "/$mailboxId/tasks",
            params: { mailboxId: defaultMailboxId },
          });
        } else {
          navigate({ to: "/get-started" });
        }
      } else if (target === "docs") {
        navigate({ to: "/docs" });
      } else if (target === "settings") {
        navigate({ to: "/settings" });
      } else if (defaultMailboxId != null) {
        navigate({
          to: target === "home" ? "/$mailboxId/home" : "/$mailboxId/agenda",
          params: { mailboxId: defaultMailboxId },
        });
      } else {
        navigate({ to: "/get-started" });
      }

      close();
    },
    [close, defaultMailboxId, navigate],
  );

  const navigationCommands = useMemo(() => {
    const all = buildNavigationCommands(runNavigation, navigateToInbox);
    return all.filter((cmd) => {
      if (isEmailsRoute && cmd.id === "inbox") return false;
      if (isTasksRoute && cmd.id === "tasks") return false;
      if (isHomeRoute && cmd.id === "home") return false;
      return true;
    });
  }, [runNavigation, navigateToInbox, isEmailsRoute, isTasksRoute, isHomeRoute]);

  const accountCommands = useMemo(
    () =>
      isMailboxRoute && activeMailboxId != null
        ? buildAccountCommands(
            activeMailboxId,
            currentMailboxView,
            currentRouteId,
            routeSearch,
            accounts,
            navigate,
            close,
          )
        : [],
    [
      activeMailboxId,
      close,
      currentMailboxView,
      currentRouteId,
      isMailboxRoute,
      navigate,
      routeSearch,
      accounts,
    ],
  );

  const taskViewCommands = useMemo(
    () => buildTaskViewCommands(isTasksRoute, defaultMailboxId, navigate, close),
    [isTasksRoute, defaultMailboxId, navigate, close],
  );

  const actionCommands = useMemo(
    () =>
      buildActionCommands({
        close,
        resolvedTheme,
        toggleTheme,
        logout,
      }),
    [close, resolvedTheme, toggleTheme, logout],
  );

  const agentSuggestions = useMemo(() => {
    if (isEmailsRoute) {
      return [
        "Summarize what I'm looking at",
        "Draft a reply for the current email",
        "What should I follow up on here?",
      ];
    }
    if (isTasksRoute) {
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
  }, [isEmailsRoute, isTasksRoute]);

  return {
    visibleNavigationCommands: navigationCommands,
    accountCommands,
    taskNavigationCommands: taskViewCommands,
    actionCommands,
    agentSuggestions,
  };
}
