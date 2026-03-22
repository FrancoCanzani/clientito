import { useEmailCommandActions } from "@/features/inbox/hooks/use-email-command-state";
import {
  VIEW_LABELS,
  type EmailView,
} from "@/features/inbox/utils/inbox-filters";
import { createNote } from "@/features/notes/mutations";
import { createTask } from "@/features/tasks/mutations";
import { parseTaskInput } from "@/features/tasks/utils";
import { useLogout } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import {
  ArchiveIcon,
  CheckSquareIcon,
  EnvelopeSimpleIcon,
  FunnelIcon,
  GearIcon,
  HouseSimpleIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  NewspaperIcon,
  NoteBlankIcon,
  PaperPlaneTiltIcon,
  SignOutIcon,
  StarIcon,
  SunIcon,
  TrashIcon,
  TrayIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import React, { useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { PaletteCommand, PaletteMode } from "./types";

/** Extract the current mailbox $id from the pathname, defaulting to "all". */
function getActiveInboxId(pathname: string): string {
  const match = pathname.match(/^\/inbox\/([^/]+)/);
  return match?.[1] ?? "all";
}

export function usePaletteCommands({
  close,
  setMode,
}: {
  close: () => void;
  setMode: (mode: PaletteMode) => void;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const issueEmailCommand = useEmailCommandActions();
  const logout = useLogout();
  const { resolved: resolvedTheme, toggle: toggleTheme } = useTheme();

  const pathname = router.state.location.pathname;
  const activeInboxId = getActiveInboxId(pathname);

  const navigateToInbox = useCallback(() => {
    navigate({ to: "/inbox/$id", params: { id: activeInboxId } });
    close();
  }, [close, navigate, activeInboxId]);

  const runNavigation = useCallback(
    (to: "/home" | "/notes" | "/tasks" | "/settings") => {
      navigate({ to });
      close();
    },
    [close, navigate],
  );

  const createTaskMutation = useMutation({
    mutationFn: async (input: { title: string; dueAt?: number }) =>
      createTask(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void router.invalidate();
      toast.success("Task created");
      close();
    },
    onError: () => toast.error("Failed to create task"),
  });

  const createNoteMutation = useMutation({
    mutationFn: async () =>
      createNote({
        title: "Untitled note",
        content: "",
      }),
    onSuccess: (created) => {
      navigate({
        to: "/notes/$noteId",
        params: { noteId: created.id },
      });
      close();
    },
    onError: () => toast.error("Failed to create note"),
  });

  const isEmailsRoute = pathname.startsWith("/inbox/");
  const isTasksRoute = pathname === "/tasks";

  const commands: PaletteCommand[] = useMemo(() => {
    const viewIcons: Record<
      string,
      React.ComponentType<{ className?: string }>
    > = {
      inbox: TrayIcon,
      sent: PaperPlaneTiltIcon,
      spam: WarningIcon,
      trash: TrashIcon,
      archived: ArchiveIcon,
      starred: StarIcon,
    };

    const emailViewCommands: PaletteCommand[] = isEmailsRoute
      ? (
          [
            "inbox",
            "sent",
            "archived",
            "starred",
            "spam",
            "trash",
          ] as EmailView[]
        ).map((view) => ({
          id: `email-view-${view}`,
          label: VIEW_LABELS[view],
          section: "email-navigation",
          icon: React.createElement(viewIcons[view] ?? TrayIcon, {
            className: "size-4",
          }),
          onSelect: () => {
            navigate({
              to: "/inbox/$id",
              params: { id: activeInboxId },
              search: (prev) => ({
                ...prev,
                view: view === "inbox" ? undefined : view,
                id: undefined,
              }),
            });
            close();
          },
        }))
      : [];

    const mailboxCommands: PaletteCommand[] = isEmailsRoute
      ? [
          ...emailViewCommands,
          {
            id: "search-emails",
            label: "Search",
            section: "email-navigation",
            icon: React.createElement(MagnifyingGlassIcon, {
              className: "size-4",
            }),
            onSelect: () => setMode("search"),
          },
          {
            id: "subscriptions",
            label: "Subscriptions",
            section: "email-navigation",
            icon: React.createElement(NewspaperIcon, { className: "size-4" }),
            onSelect: () => {
              navigate({
                to: "/inbox/$id/subscriptions",
                params: { id: activeInboxId },
              });
              close();
            },
          },
          {
            id: "filters",
            label: "Filters",
            section: "email-navigation",
            icon: React.createElement(FunnelIcon, { className: "size-4" }),
            onSelect: () => {
              navigate({
                to: "/inbox/$id/filters",
                params: { id: activeInboxId },
              });
              close();
            },
          },
        ]
      : [];

    const emailSelectionCommands: PaletteCommand[] = isEmailsRoute
      ? [
          {
            id: "email-selection-mode",
            label: "Select inbox items",
            section: "email-selection",
            icon: React.createElement(CheckSquareIcon, {
              className: "size-4",
            }),
            onSelect: () => {
              issueEmailCommand({
                type: "selection-mode",
                enabled: true,
              });
              close();
            },
          },
          {
            id: "email-select-all",
            label: "Select all visible",
            section: "email-selection",
            icon: React.createElement(CheckSquareIcon, {
              className: "size-4",
            }),
            onSelect: () => {
              issueEmailCommand({ type: "select-all-visible" });
              close();
            },
          },
          {
            id: "email-clear-selection",
            label: "Clear selection",
            section: "email-selection",
            icon: React.createElement(CheckSquareIcon, {
              className: "size-4",
            }),
            onSelect: () => {
              issueEmailCommand({ type: "clear-selection" });
              close();
            },
          },
        ]
      : [];

    const taskViewCommands: PaletteCommand[] = isTasksRoute
      ? (
          [
            { view: "all", label: "All Tasks" },
            { view: "today", label: "Due Today" },
            { view: "upcoming", label: "Upcoming" },
          ] as const
        ).map(({ view, label }) => ({
          id: `task-view-${view}`,
          label,
          section: "task-navigation",
          icon: React.createElement(CheckSquareIcon, { className: "size-4" }),
          onSelect: () => {
            navigate({
              to: "/tasks",
              search: (prev) => ({
                ...prev,
                view: view === "all" ? undefined : view,
              }),
            });
            close();
          },
        }))
      : [];

    return [
      {
        id: "home",
        label: "Home",
        section: "navigation",
        to: "/home",
        icon: React.createElement(HouseSimpleIcon, { className: "size-4" }),
        onSelect: () => runNavigation("/home"),
      },
      {
        id: "inbox",
        label: "Inbox",
        section: "navigation",
        to: "/inbox/$id",
        icon: React.createElement(TrayIcon, { className: "size-4" }),
        onSelect: navigateToInbox,
      },
      {
        id: "tasks",
        label: "Tasks",
        section: "navigation",
        to: "/tasks",
        icon: React.createElement(CheckSquareIcon, { className: "size-4" }),
        onSelect: () => runNavigation("/tasks"),
      },
      {
        id: "notes",
        label: "Notes",
        section: "navigation",
        to: "/notes",
        icon: React.createElement(NoteBlankIcon, { className: "size-4" }),
        onSelect: () => runNavigation("/notes"),
      },
      {
        id: "settings",
        label: "Settings",
        section: "navigation",
        to: "/settings",
        icon: React.createElement(GearIcon, { className: "size-4" }),
        onSelect: () => runNavigation("/settings"),
      },
      ...mailboxCommands,
      ...taskViewCommands,
      {
        id: "compose",
        label: "New Email",
        section: "actions",
        icon: React.createElement(EnvelopeSimpleIcon, {
          className: "size-4",
        }),
        onSelect: () => {
          navigate({
            to: "/inbox/$id",
            params: { id: activeInboxId },
            search: { compose: true },
          });
          close();
        },
      },
      ...emailSelectionCommands,
      {
        id: "new-task",
        label: "New Task",
        section: "actions",
        icon: React.createElement(CheckSquareIcon, { className: "size-4" }),
        onSelect: () => setMode("new-task"),
      },
      {
        id: "new-note",
        label: "New Note",
        section: "actions",
        icon: React.createElement(NoteBlankIcon, { className: "size-4" }),
        onSelect: () => createNoteMutation.mutate(),
      },
      {
        id: "toggle-theme",
        label:
          resolvedTheme === "dark"
            ? "Switch to Light Mode"
            : "Switch to Dark Mode",
        section: "actions",
        icon:
          resolvedTheme === "dark"
            ? React.createElement(SunIcon, { className: "size-4" })
            : React.createElement(MoonIcon, { className: "size-4" }),
        onSelect: () => {
          toggleTheme();
          close();
        },
      },
      {
        id: "sign-out",
        label: "Sign out",
        section: "actions",
        icon: React.createElement(SignOutIcon, { className: "size-4" }),
        onSelect: () => {
          logout.mutate();
          close();
        },
      },
    ];
  }, [
    activeInboxId,
    close,
    createNoteMutation,
    isEmailsRoute,
    isTasksRoute,
    issueEmailCommand,
    logout,
    navigate,
    navigateToInbox,
    resolvedTheme,
    runNavigation,
    setMode,
    toggleTheme,
  ]);

  const navigationCommands = commands.filter(
    (command) => command.section === "navigation",
  );
  const visibleNavigationCommands = navigationCommands.filter((command) => {
    if (isEmailsRoute && command.id === "inbox") return false;
    if (isTasksRoute && command.id === "tasks") return false;
    return true;
  });
  const emailNavigationCommands = commands.filter(
    (command) => command.section === "email-navigation",
  );
  const taskNavigationCommands = commands.filter(
    (command) => command.section === "task-navigation",
  );
  const emailSelectionCommands = commands.filter(
    (command) => command.section === "email-selection",
  );
  const actionCommands = commands.filter(
    (command) => command.section === "actions",
  );

  const agentSuggestions = useMemo(() => {
    if (pathname.startsWith("/inbox/")) {
      return [
        "Summarize what I'm looking at",
        "Draft a reply for the current email",
        "What should I follow up on here?",
      ];
    }
    if (pathname === "/notes" || pathname.startsWith("/notes/")) {
      return [
        "Summarize this note",
        "Turn this note into tasks",
        "What is missing here?",
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

  const submitTask = useCallback(
    (taskInput: string) => {
      const parsed = parseTaskInput(taskInput);
      const title = parsed.title.trim();
      if (!title) return;
      createTaskMutation.mutate({ title, dueAt: parsed.dueAt });
    },
    [createTaskMutation],
  );

  return {
    queryClient,
    visibleNavigationCommands,
    emailNavigationCommands,
    taskNavigationCommands,
    emailSelectionCommands,
    actionCommands,
    agentSuggestions,
    submitTask,
    createTaskMutation,
  };
}
