import { VIEW_VALUES, type EmailView } from "@/features/email/inbox/utils/inbox-filters";
import { getPreferredMailboxId } from "@/features/email/inbox/utils/mailbox";
import { useLogout } from "@/hooks/use-auth";
import { getMailboxDisplayEmail, useMailboxes } from "@/hooks/use-mailboxes";
import { useTheme } from "@/hooks/use-theme";
import {
  AtIcon,
  GearIcon,
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
  runNavigation: (target: "settings") => void,
  navigateToInbox: () => void,
): PaletteCommand[] {
  return [
    {
      id: "inbox",
      label: "Inbox",
      icon: paletteIcon(TrayIcon),
      onSelect: navigateToInbox,
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
  currentLabel: string | undefined,
  currentRouteId: string | undefined,
  routeSearch: {
    q?: unknown;
    includeJunk?: unknown;
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
          if (currentRouteId === "/_dashboard/$mailboxId/inbox/search") {
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
          } else if (currentRouteId === "/_dashboard/$mailboxId/inbox/drafts") {
            navigate({
              to: "/$mailboxId/inbox/drafts",
              params: { mailboxId },
            });
          } else if (
            currentRouteId?.startsWith("/_dashboard/$mailboxId/inbox") ||
            currentRouteId === "/_dashboard/$mailboxId/$folder/" ||
            currentRouteId === "/_dashboard/$mailboxId/$folder/email/$emailId"
          ) {
            if (currentLabel === "important" || currentMailboxView === "important") {
              navigate({
                to: "/$mailboxId/inbox/labels/$label",
                params: { mailboxId, label: "important" },
              });
            } else if (currentMailboxView === "inbox") {
              navigate({
                to: "/$mailboxId/inbox",
                params: { mailboxId },
              });
            } else if (currentMailboxView) {
              navigate({
                to: "/$mailboxId/$folder",
                params: { mailboxId, folder: currentMailboxView },
              });
            } else {
              navigate({
                to: "/$mailboxId/inbox",
                params: { mailboxId },
              });
            }
          } else {
            navigate({
              to: "/$mailboxId/inbox",
              params: { mailboxId },
            });
          }

          close();
        },
      } satisfies PaletteCommand;
    });
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
    match.routeId.startsWith("/_dashboard/$mailboxId/inbox") ||
    match.routeId === "/_dashboard/$mailboxId/$folder/" ||
    match.routeId === "/_dashboard/$mailboxId/$folder/email/$emailId",
  );
  const routeSearch = router.state.location.search as {
    q?: unknown;
    includeJunk?: unknown;
  };
  const currentFolder = matches.find(
    (match) => match.routeId === "/_dashboard/$mailboxId/$folder/",
  )?.params.folder;
  const currentLabel = matches.find(
    (match) => match.routeId === "/_dashboard/$mailboxId/inbox/labels/$label/",
  )?.params.label;
  const folderView = VIEW_VALUES.includes(currentFolder as EmailView)
    ? (currentFolder as EmailView)
    : undefined;
  const labelView = currentLabel === "important" ? "important" : undefined;
  const isInboxRootRoute =
    currentRouteId === "/_dashboard/$mailboxId/inbox/" ||
    currentRouteId === "/_dashboard/$mailboxId/inbox/email/$emailId";
  const currentMailboxView: EmailView | undefined =
    labelView ?? folderView ?? (isInboxRootRoute ? "inbox" : undefined);

  const navigateToInbox = useCallback(() => {
    if (defaultMailboxId == null) {
      navigate({ to: "/get-started" });
      close();
      return;
    }

    navigate({
      to: "/$mailboxId/inbox",
      params: { mailboxId: defaultMailboxId },
    });
    close();
  }, [close, defaultMailboxId, navigate]);

  const runNavigation = useCallback(
    (target: "settings") => {
      if (target === "settings") {
        navigate({ to: "/settings" });
      }
      close();
    },
    [close, navigate],
  );

  const navigationCommands = useMemo(() => {
    const all = buildNavigationCommands(runNavigation, navigateToInbox);
    return all.filter((cmd) => !(isEmailsRoute && cmd.id === "inbox"));
  }, [runNavigation, navigateToInbox, isEmailsRoute]);

  const accountCommands = useMemo(
    () =>
      isMailboxRoute && activeMailboxId != null
        ? buildAccountCommands(
            activeMailboxId,
            currentMailboxView,
            currentLabel,
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
      currentLabel,
      currentMailboxView,
      currentRouteId,
      isMailboxRoute,
      navigate,
      routeSearch,
      accounts,
    ],
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

    return [
      "What needs my attention in email today?",
      "Find emails I should reply to",
      "Draft a concise response for this sender",
    ];
  }, [isEmailsRoute]);

  return {
    visibleNavigationCommands: navigationCommands,
    accountCommands,
    actionCommands,
    agentSuggestions,
  };
}
