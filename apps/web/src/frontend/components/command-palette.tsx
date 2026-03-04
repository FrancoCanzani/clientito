import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchCompanies } from "@/features/companies/api";
import { fetchEmails } from "@/features/emails/queries/fetch-emails";
import { fetchPeople } from "@/features/people/api";
import { createTask, fetchTasks } from "@/features/tasks/api";
import { parseTaskInput } from "@/features/tasks/parse-task-input";
import { useLogout } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import {
  BuildingsIcon,
  CaretDownIcon,
  CaretRightIcon,
  CheckSquareIcon,
  EnvelopeSimpleIcon,
  GearIcon,
  HouseSimpleIcon,
  MoonIcon,
  PlusIcon,
  SignOutIcon,
  SunIcon,
  TrayIcon,
  UserListIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const commandGroupHeadingClassName =
  "**:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-1 **:[[cmdk-group-heading]]:text-[10px] **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:text-muted-foreground";

export function CommandPalette() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useLogout();
  const { resolved: resolvedTheme, toggle: toggleTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [newTaskMode, setNewTaskMode] = useState(false);
  const [taskInput, setTaskInput] = useState("");

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setNewTaskMode(false);
    setTaskInput("");
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (event.key === "Escape") {
        close();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close]);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        close();
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [close, open]);

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

  const runNavigation = useCallback(
    (
      to:
        | "/home"
        | "/emails"
        | "/people"
        | "/companies"
        | "/tasks"
        | "/settings",
    ) => {
      navigate({ to });
      close();
    },
    [close, navigate],
  );

  const prefetchNavigationRoute = useCallback(
    (
      to:
        | "/home"
        | "/emails"
        | "/people"
        | "/companies"
        | "/tasks"
        | "/settings",
    ) => {
      void router.preloadRoute({ to });
    },
    [router],
  );

  const normalizedQuery = query.trim();

  const commands = useMemo(
    () => [
      {
        id: "home",
        label: "Home",
        section: "navigation" as const,
        to: "/home" as const,
        icon: <HouseSimpleIcon className="size-4" />,
        onSelect: () => runNavigation("/home"),
      },
      {
        id: "inbox",
        label: "Inbox",
        section: "navigation" as const,
        to: "/emails" as const,
        icon: <TrayIcon className="size-4" />,
        onSelect: () => runNavigation("/emails"),
      },
      {
        id: "people",
        label: "People",
        section: "navigation" as const,
        to: "/people" as const,
        icon: <UserListIcon className="size-4" />,
        onSelect: () => runNavigation("/people"),
      },
      {
        id: "companies",
        label: "Companies",
        section: "navigation" as const,
        to: "/companies" as const,
        icon: <BuildingsIcon className="size-4" />,
        onSelect: () => runNavigation("/companies"),
      },
      {
        id: "tasks",
        label: "Tasks",
        section: "navigation" as const,
        to: "/tasks" as const,
        icon: <CheckSquareIcon className="size-4" />,
        onSelect: () => runNavigation("/tasks"),
      },
      {
        id: "settings",
        label: "Settings",
        section: "navigation" as const,
        to: "/settings" as const,
        icon: <GearIcon className="size-4" />,
        onSelect: () => runNavigation("/settings"),
      },
      {
        id: "compose",
        label: "Compose Email",
        section: "actions" as const,
        icon: <EnvelopeSimpleIcon className="size-4" />,
        onSelect: () => {
          navigate({
            to: "/emails",
            search: (prev) => ({ ...prev, compose: true }),
          });
          close();
        },
      },
      {
        id: "new-task",
        label: "New Task",
        section: "actions" as const,
        icon: <PlusIcon className="size-4" />,
        onSelect: () => setNewTaskMode(true),
      },
      {
        id: "toggle-theme",
        label:
          resolvedTheme === "dark"
            ? "Switch to Light Mode"
            : "Switch to Dark Mode",
        section: "actions" as const,
        icon:
          resolvedTheme === "dark" ? (
            <SunIcon className="size-4" />
          ) : (
            <MoonIcon className="size-4" />
          ),
        onSelect: () => {
          toggleTheme();
          close();
        },
      },
      {
        id: "sign-out",
        label: "Sign out",
        section: "actions" as const,
        icon: <SignOutIcon className="size-4" />,
        onSelect: () => {
          logout.mutate();
          close();
        },
      },
    ],
    [close, logout, navigate, resolvedTheme, runNavigation, toggleTheme],
  );

  const navigationCommands = commands.filter(
    (command) => command.section === "navigation",
  );
  const actionCommands = commands.filter(
    (command) => command.section === "actions",
  );

  const submitTask = useCallback(() => {
    const parsed = parseTaskInput(taskInput);
    const title = parsed.title.trim();
    if (!title) return;
    createTaskMutation.mutate({ title, dueAt: parsed.dueAt });
  }, [createTaskMutation, taskInput]);

  useEffect(() => {
    if (!open || newTaskMode) return;

    // Aggressive preload: routes + first-page data for core dashboard sections.
    for (const command of navigationCommands) {
      prefetchNavigationRoute(command.to);
    }

    void Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: ["emails", "inbox", "prefetch"],
        queryFn: () => fetchEmails({ limit: 100, offset: 0 }),
        staleTime: 60_000,
      }),
      queryClient.prefetchQuery({
        queryKey: ["people", "prefetch"],
        queryFn: () => fetchPeople({ limit: 50, offset: 0 }),
        staleTime: 60_000,
      }),
      queryClient.prefetchQuery({
        queryKey: ["companies", "prefetch"],
        queryFn: () => fetchCompanies(),
        staleTime: 60_000,
      }),
      queryClient.prefetchQuery({
        queryKey: ["tasks", "prefetch"],
        queryFn: () => fetchTasks({ limit: 200, offset: 0 }),
        staleTime: 30_000,
      }),
    ]);
  }, [
    navigationCommands,
    newTaskMode,
    open,
    prefetchNavigationRoute,
    queryClient,
  ]);

  return (
    <div
      ref={containerRef}
      className="fixed bottom-6 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4"
    >
      <Command
        shouldFilter
        className="overflow-hidden rounded-2xl border border-border bg-background shadow-lg"
      >
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {newTaskMode ? (
                <div className="space-y-2 p-3">
                  <p className="text-xs text-muted-foreground">Create task</p>
                  <Input
                    value={taskInput}
                    onChange={(event) => setTaskInput(event.target.value)}
                    placeholder="e.g. Send proposal tomorrow 3pm"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNewTaskMode(false)}
                    >
                      Back
                    </Button>
                    <Button
                      size="sm"
                      onClick={submitTask}
                      disabled={
                        createTaskMutation.isPending ||
                        taskInput.trim().length === 0
                      }
                    >
                      {createTaskMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto py-1">
                  <Command.List>
                    <Command.Empty className="px-3 py-3 text-sm text-muted-foreground">
                      No commands found.
                    </Command.Empty>

                    <Command.Group
                      heading="Navigation"
                      className={commandGroupHeadingClassName}
                    >
                      {navigationCommands.map((command) => (
                        <Command.Item
                          key={command.id}
                          value={command.label}
                          onSelect={command.onSelect}
                          onMouseEnter={() =>
                            prefetchNavigationRoute(command.to)
                          }
                          onFocus={() => prefetchNavigationRoute(command.to)}
                          className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm transition-colors data-[selected=true]:bg-muted"
                        >
                          <span className="text-muted-foreground">
                            {command.icon}
                          </span>
                          {command.label}
                        </Command.Item>
                      ))}
                    </Command.Group>

                    <Command.Group
                      heading="Actions"
                      className={commandGroupHeadingClassName}
                    >
                      {actionCommands.map((command) => (
                        <Command.Item
                          key={command.id}
                          value={command.label}
                          onSelect={command.onSelect}
                          className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm transition-colors data-[selected=true]:bg-muted"
                        >
                          <span className="text-muted-foreground">
                            {command.icon}
                          </span>
                          {command.label}
                        </Command.Item>
                      ))}
                    </Command.Group>

                    <Command.Group
                      heading="Search"
                      className={commandGroupHeadingClassName}
                    >
                      <Command.Item
                        value={`Search people ${normalizedQuery}`}
                        onSelect={() => {
                          navigate({
                            to: "/people",
                            search: { q: normalizedQuery || undefined },
                          });
                          close();
                        }}
                        className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm transition-colors data-[selected=true]:bg-muted"
                      >
                        <UserListIcon className="size-4 text-muted-foreground" />
                        Search people
                        {normalizedQuery ? ` for "${normalizedQuery}"` : ""}
                      </Command.Item>
                      <Command.Item
                        value={`Search companies ${normalizedQuery}`}
                        onSelect={() => {
                          navigate({
                            to: "/companies",
                            search: { q: normalizedQuery || undefined },
                          });
                          close();
                        }}
                        className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm transition-colors data-[selected=true]:bg-muted"
                      >
                        <BuildingsIcon className="size-4 text-muted-foreground" />
                        Search companies
                        {normalizedQuery ? ` for "${normalizedQuery}"` : ""}
                      </Command.Item>
                    </Command.Group>
                  </Command.List>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 px-3 py-2">
          <Command.Input
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            onFocus={() => setOpen(true)}
            placeholder="Search or navigate..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {open ? (
            <CaretDownIcon className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
        </div>
      </Command>
    </div>
  );
}
