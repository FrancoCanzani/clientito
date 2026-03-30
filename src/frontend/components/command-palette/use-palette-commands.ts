import {
  VIEW_LABELS,
  type EmailView,
} from "@/features/inbox/utils/inbox-filters";
import { createNote } from "@/features/notes/mutations";
import { createTask } from "@/features/tasks/mutations";
import { parseTaskInput } from "@/features/tasks/utils";
import { useLogout } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { getActiveInboxId } from "@/lib/utils";
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
  CalendarDotsIcon,
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

function paletteIcon(Icon: React.ComponentType<{ className?: string }>) {
  return React.createElement(Icon, { className: "size-4" });
}

const VIEW_ICONS: Record<string, React.ComponentType<{ className?: string }>> =
  {
    inbox: TrayIcon,
    sent: PaperPlaneTiltIcon,
    spam: WarningIcon,
    trash: TrashIcon,
    archived: ArchiveIcon,
    starred: StarIcon,
  };

function buildNavigationCommands(
  runNavigation: (to: "/home" | "/notes" | "/tasks" | "/docs" | "/settings" | "/agenda") => void,
  navigateToInbox: () => void,
): PaletteCommand[] {
  return [
    { id: "home", label: "Home", section: "navigation", to: "/home", icon: paletteIcon(HouseSimpleIcon), onSelect: () => runNavigation("/home") },
    { id: "inbox", label: "Inbox", section: "navigation", to: "/inbox/$id", icon: paletteIcon(TrayIcon), onSelect: navigateToInbox },
    { id: "tasks", label: "Tasks", section: "navigation", to: "/tasks", icon: paletteIcon(CheckSquareIcon), onSelect: () => runNavigation("/tasks") },
    { id: "notes", label: "Notes", section: "navigation", to: "/notes", icon: paletteIcon(NoteBlankIcon), onSelect: () => runNavigation("/notes") },
    { id: "agenda", label: "Agenda", section: "navigation", to: "/agenda", icon: paletteIcon(CalendarDotsIcon), onSelect: () => runNavigation("/agenda") },
    { id: "settings", label: "Settings", section: "navigation", to: "/settings", icon: paletteIcon(GearIcon), onSelect: () => runNavigation("/settings") },
  ];
}

function buildMailboxCommands(
  isEmailsRoute: boolean,
  activeInboxId: string,
  navigate: ReturnType<typeof useNavigate>,
  close: () => void,
  setMode: (mode: PaletteMode) => void,
): PaletteCommand[] {
  if (!isEmailsRoute) return [];

  const emailViews: EmailView[] = ["inbox", "sent", "archived", "starred", "spam", "trash"];
  const viewCommands: PaletteCommand[] = emailViews.map((view) => ({
    id: `email-view-${view}`,
    label: VIEW_LABELS[view],
    section: "email-navigation",
    icon: paletteIcon(VIEW_ICONS[view] ?? TrayIcon),
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
  }));

  return [
    ...viewCommands,
    {
      id: "search-emails",
      label: "Search",
      section: "email-navigation",
      icon: paletteIcon(MagnifyingGlassIcon),
      onSelect: () => setMode("search"),
    },
    {
      id: "subscriptions",
      label: "Subscriptions",
      section: "email-navigation",
      icon: paletteIcon(NewspaperIcon),
      onSelect: () => {
        navigate({ to: "/inbox/$id/subscriptions", params: { id: activeInboxId } });
        close();
      },
    },
    {
      id: "filters",
      label: "Filters",
      section: "email-navigation",
      icon: paletteIcon(FunnelIcon),
      onSelect: () => {
        navigate({ to: "/inbox/$id/filters", params: { id: activeInboxId } });
        close();
      },
    },
  ];
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
    section: "task-navigation",
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
  activeInboxId: string;
  navigate: ReturnType<typeof useNavigate>;
  close: () => void;
  setMode: (mode: PaletteMode) => void;
  createNoteMutation: { mutate: () => void };
  resolvedTheme: string | undefined;
  toggleTheme: () => void;
  logout: { mutate: () => void };
}): PaletteCommand[] {
  const { activeInboxId, navigate, close, setMode, createNoteMutation, resolvedTheme, toggleTheme, logout } = opts;

  return [
    {
      id: "compose",
      label: "New Email",
      section: "actions",
      icon: paletteIcon(EnvelopeSimpleIcon),
      onSelect: () => {
        navigate({ to: "/inbox/$id", params: { id: activeInboxId }, search: { compose: true } });
        close();
      },
    },
    {
      id: "new-task",
      label: "New Task",
      section: "actions",
      icon: paletteIcon(CheckSquareIcon),
      onSelect: () => setMode("new-task"),
    },
    {
      id: "new-note",
      label: "New Note",
      section: "actions",
      icon: paletteIcon(NoteBlankIcon),
      onSelect: () => createNoteMutation.mutate(),
    },
    {
      id: "toggle-theme",
      label: resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
      section: "actions",
      icon: paletteIcon(resolvedTheme === "dark" ? SunIcon : MoonIcon),
      onSelect: () => { toggleTheme(); close(); },
    },
    {
      id: "sign-out",
      label: "Sign out",
      section: "actions",
      icon: paletteIcon(SignOutIcon),
      onSelect: () => { logout.mutate(); close(); },
    },
  ];
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
  const logout = useLogout();
  const { resolved: resolvedTheme, toggle: toggleTheme } = useTheme();

  const pathname = router.state.location.pathname;
  const activeInboxId = getActiveInboxId(pathname);
  const isEmailsRoute = pathname.startsWith("/inbox/");
  const isTasksRoute = pathname === "/tasks";

  const navigateToInbox = useCallback(() => {
    navigate({ to: "/inbox/$id", params: { id: activeInboxId } });
    close();
  }, [close, navigate, activeInboxId]);

  const runNavigation = useCallback(
    (to: "/home" | "/notes" | "/tasks" | "/docs" | "/settings" | "/agenda") => {
      navigate({ to });
      close();
    },
    [close, navigate],
  );

  const createTaskMutation = useMutation({
    mutationFn: async (input: { title: string; dueAt?: number }) =>
      createTask(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      router.invalidate();
      toast.success("Task created");
      close();
    },
    onError: () => toast.error("Failed to create task"),
  });

  const createNoteMutation = useMutation({
    mutationFn: async () =>
      createNote({ title: "Untitled note", content: "" }),
    onSuccess: (created) => {
      navigate({ to: "/notes/$noteId", params: { noteId: created.id } });
      close();
    },
    onError: () => toast.error("Failed to create note"),
  });

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

  const mailboxCommands = useMemo(
    () => buildMailboxCommands(isEmailsRoute, activeInboxId, navigate, close, setMode),
    [isEmailsRoute, activeInboxId, navigate, close, setMode],
  );

  const taskViewCommands = useMemo(
    () => buildTaskViewCommands(isTasksRoute, navigate, close),
    [isTasksRoute, navigate, close],
  );

  const actionCommands = useMemo(
    () => buildActionCommands({
      activeInboxId, navigate, close, setMode,
      createNoteMutation, resolvedTheme, toggleTheme, logout,
    }),
    [activeInboxId, navigate, close, setMode, createNoteMutation, resolvedTheme, toggleTheme, logout],
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
    visibleNavigationCommands: navigationCommands,
    emailNavigationCommands: mailboxCommands,
    taskNavigationCommands: taskViewCommands,
    actionCommands,
    agentSuggestions,
    submitTask,
    createTaskMutation,
  };
}
