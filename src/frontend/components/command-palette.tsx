import {
  AgentMessage,
  AgentThinking,
  ToolApprovalCard,
} from "@/components/agent-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openCompose } from "@/features/inbox/compose-bridge";
import { useEmailCommandActions } from "@/features/inbox/hooks/use-email-command-state";
import {
  VIEW_LABELS,
  type EmailView,
} from "@/features/inbox/utils/inbox-filters";
import { createNote } from "@/features/notes/mutations";
import { createTask } from "@/features/tasks/mutations";
import { parseTaskInput } from "@/features/tasks/utils";
import { useAppAgent } from "@/hooks/use-agent";
import { useLogout } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import {
  CaretDownIcon,
  CaretRightIcon,
  CheckSquareIcon,
  EnvelopeSimpleIcon,
  FunnelIcon,
  GearIcon,
  HouseSimpleIcon,
  KeyReturnIcon,
  MoonIcon,
  NewspaperIcon,
  NoteBlankIcon,
  PaperPlaneTiltIcon,
  PlusIcon,
  SignOutIcon,
  SunIcon,
  TrashIcon,
  TrayIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { getToolName, isToolUIPart } from "ai";
import { Command } from "cmdk";
import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const commandGroupHeadingClassName =
  "**:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-1 **:[[cmdk-group-heading]]:text-[10px] **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:text-muted-foreground";

function getAgentStatusLabel(
  status: "ready" | "streaming" | "submitted" | "error",
  isConnected: boolean,
) {
  if (!isConnected) return "Connecting";
  if (status === "submitted") return "Sending request";
  if (status === "streaming") return "Working";
  if (status === "error") return null;
  return null;
}

export function CommandPalette() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const issueEmailCommand = useEmailCommandActions();
  const logout = useLogout();
  const { resolved: resolvedTheme, toggle: toggleTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const agentInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [newTaskMode, setNewTaskMode] = useState(false);
  const [taskInput, setTaskInput] = useState("");
  const [agentMode, setAgentMode] = useState(false);
  const [agentHasSubmitted, setAgentHasSubmitted] = useState(false);

  const {
    messages,
    sendMessage,
    status,
    addToolApprovalResponse,
    clearHistory,
    isConnected,
  } = useAppAgent();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setNewTaskMode(false);
    setTaskInput("");
    setAgentHasSubmitted(false);
    if (agentMode) {
      setAgentMode(false);
    }
  }, [agentMode]);

  const submitAgentMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setAgentHasSubmitted(true);
      sendMessage({ text: trimmed });
    },
    [sendMessage],
  );

  const enterAgentMode = useCallback(
    (initialQuery?: string) => {
      const text = initialQuery?.trim();
      setAgentMode(true);
      setOpen(true);
      setQuery("");
      setAgentHasSubmitted(false);
      setTimeout(() => agentInputRef.current?.focus(), 0);
      if (text) {
        submitAgentMessage(text);
      }
    },
    [submitAgentMessage],
  );

  const startFreshChat = useCallback(() => {
    setAgentHasSubmitted(false);
    clearHistory();
    setTimeout(() => agentInputRef.current?.focus(), 0);
  }, [clearHistory]);

  useHotkey("Mod+K", () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  });

  useHotkey(
    "Escape",
    () => {
      if (agentMode) {
        setAgentMode(false);
        setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }

      close();
    },
    {
      enabled: open || agentMode,
      preventDefault: false,
      stopPropagation: false,
    },
  );

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

  useEffect(() => {
    if (!agentMode) return;
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [agentMode, messages, status]);

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

  const runNavigation = useCallback(
    (to: "/home" | "/inbox" | "/notes" | "/tasks" | "/settings") => {
      navigate({ to });
      close();
    },
    [close, navigate],
  );

  const normalizedQuery = query.trim();
  const isEmailsRoute = router.state.location.pathname === "/inbox";
  const isTasksRoute = router.state.location.pathname === "/tasks";

  const commands = useMemo(() => {
    const emailViewCommands = isEmailsRoute
      ? (["inbox", "sent", "spam", "trash"] as EmailView[]).map((view) => ({
          id: `email-view-${view}`,
          label: VIEW_LABELS[view],
          section: "email-navigation",
          icon:
            view === "trash" ? (
              <TrashIcon className="size-4" />
            ) : view === "sent" ? (
              <PaperPlaneTiltIcon className="size-4" />
            ) : view === "spam" ? (
              <WarningIcon className="size-4" />
            ) : (
              <TrayIcon className="size-4" />
            ),
          onSelect: () => {
            navigate({
              to: "/inbox",
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

    const emailSelectionCommands = isEmailsRoute
      ? [
          {
            id: "email-selection-mode",
            label: "Select inbox items",
            section: "email-selection",
            icon: <CheckSquareIcon className="size-4" />,
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
            icon: <CheckSquareIcon className="size-4" />,
            onSelect: () => {
              issueEmailCommand({ type: "select-all-visible" });
              close();
            },
          },
          {
            id: "email-clear-selection",
            label: "Clear selection",
            section: "email-selection",
            icon: <CheckSquareIcon className="size-4" />,
            onSelect: () => {
              issueEmailCommand({ type: "clear-selection" });
              close();
            },
          },
        ]
      : [];

    const taskViewCommands = isTasksRoute
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
          icon: <CheckSquareIcon className="size-4" />,
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
        icon: <HouseSimpleIcon className="size-4" />,
        onSelect: () => runNavigation("/home"),
      },
      {
        id: "inbox",
        label: "Inbox",
        section: "navigation",
        to: "/inbox",
        icon: <TrayIcon className="size-4" />,
        onSelect: () => runNavigation("/inbox"),
      },
      {
        id: "tasks",
        label: "Tasks",
        section: "navigation",
        to: "/tasks",
        icon: <CheckSquareIcon className="size-4" />,
        onSelect: () => runNavigation("/tasks"),
      },
      {
        id: "notes",
        label: "Notes",
        section: "navigation",
        to: "/notes",
        icon: <NoteBlankIcon className="size-4" />,
        onSelect: () => runNavigation("/notes"),
      },
      {
        id: "subscriptions",
        label: "Subscriptions",
        section: "navigation",
        icon: <NewspaperIcon className="size-4" />,
        onSelect: () => {
          navigate({ to: "/inbox/subscriptions" });
          close();
        },
      },
      {
        id: "filters",
        label: "Email Filters",
        section: "navigation",
        icon: <FunnelIcon className="size-4" />,
        onSelect: () => {
          navigate({ to: "/inbox/filters" });
          close();
        },
      },
      {
        id: "settings",
        label: "Settings",
        section: "navigation",
        to: "/settings",
        icon: <GearIcon className="size-4" />,
        onSelect: () => runNavigation("/settings"),
      },
      ...emailViewCommands,
      ...taskViewCommands,
      {
        id: "compose",
        label: "Compose Message",
        section: "actions",
        icon: <EnvelopeSimpleIcon className="size-4" />,
        onSelect: () => {
          navigate({
            to: "/inbox",
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
        icon: <PlusIcon className="size-4" />,
        onSelect: () => setNewTaskMode(true),
      },
      {
        id: "new-note",
        label: "New Note",
        section: "actions",
        icon: <NoteBlankIcon className="size-4" />,
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
        section: "actions",
        icon: <SignOutIcon className="size-4" />,
        onSelect: () => {
          logout.mutate();
          close();
        },
      },
    ];
  }, [
    close,
    createNoteMutation,
    isEmailsRoute,
    issueEmailCommand,
    logout,
    navigate,
    resolvedTheme,
    runNavigation,
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
  const agentStatusLabel = getAgentStatusLabel(status, isConnected);
  const agentSuggestions = useMemo(() => {
    if (router.state.location.pathname === "/inbox") {
      return [
        "Summarize what I'm looking at",
        "Draft a reply for the current email",
        "What should I follow up on here?",
      ];
    }

    if (router.state.location.pathname === "/notes") {
      return [
        "Summarize this note",
        "Turn this note into tasks",
        "What is missing here?",
      ];
    }

    if (router.state.location.pathname === "/tasks") {
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
  }, [router.state.location.pathname]);

  const submitTask = useCallback(() => {
    const parsed = parseTaskInput(taskInput);
    const title = parsed.title.trim();
    if (!title) return;
    createTaskMutation.mutate({ title, dueAt: parsed.dueAt });
  }, [createTaskMutation, taskInput]);

  const [agentInput, setAgentInput] = useState("");

  const handleAgentSubmit = useCallback(() => {
    const text = agentInput.trim();
    if (!text) return;
    submitAgentMessage(text);
    setAgentInput("");
  }, [agentInput, submitAgentMessage]);

  const handleApprove = useCallback(
    (toolCallId: string, toolName?: string, args?: Record<string, unknown>) => {
      addToolApprovalResponse({ id: toolCallId, approved: true });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["emails"] });
      void queryClient.invalidateQueries({ queryKey: ["notes"] });

      if (toolName === "composeEmail" && args) {
        openCompose({
          to: args.to as string | undefined,
          subject: args.subject as string | undefined,
          body: args.body as string | undefined,
        });
        close();
      }
    },
    [addToolApprovalResponse, close, queryClient],
  );

  const handleDiscard = useCallback(
    (toolCallId: string) => {
      addToolApprovalResponse({ id: toolCallId, approved: false });
    },
    [addToolApprovalResponse],
  );

  return (
    <div
      ref={containerRef}
      className="fixed bottom-6 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-2"
    >
      <Command
        shouldFilter={!agentMode}
        className="overflow-hidden rounded-xl border border-border bg-background shadow-lg"
      >
        <LazyMotion features={domAnimation}>
          <AnimatePresence>
            {open && (
              <m.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                {agentMode ? (
                  <div className="flex h-96 flex-col md:h-116">
                    <div className="flex items-start justify-between gap-3 border-b border-border/70 p-2.5">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">Agent</p>
                        {agentStatusLabel ? (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {agentStatusLabel}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          size="xs"
                          variant={"outline"}
                          onClick={startFreshChat}
                        >
                          New chat
                        </Button>
                      </div>
                    </div>

                    <div
                      ref={messagesViewportRef}
                      className="flex-1 overflow-y-auto py-2"
                    >
                      {messages.length > 0 ? (
                        messages.map((message) => (
                          <div key={message.id}>
                            <AgentMessage message={message} />
                            {message.parts
                              .filter(
                                (part) =>
                                  isToolUIPart(part) &&
                                  part.state === "approval-requested",
                              )
                              .map((part) => {
                                return (
                                  <ToolApprovalCard
                                    key={part.toolCallId}
                                    toolCallId={part.approval.id}
                                    toolName={getToolName(part)}
                                    args={part.input as Record<string, unknown>}
                                    onApprove={(id) =>
                                      handleApprove(
                                        id,
                                        getToolName(part),
                                        part.input as Record<string, unknown>,
                                      )
                                    }
                                    onDiscard={handleDiscard}
                                  />
                                );
                              })}
                          </div>
                        ))
                      ) : (
                        <div className="space-y-4 px-3 py-4">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Ask the agent</p>
                            <p className="text-xs text-muted-foreground">
                              It can read context from your current page, search
                              emails, and prepare actions for approval.
                            </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            {agentSuggestions.map((suggestion) => (
                              <Button
                                variant={"secondary"}
                                key={suggestion}
                                type="button"
                                onClick={() => submitAgentMessage(suggestion)}
                              >
                                {suggestion}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {(status === "streaming" || status === "submitted") && (
                        <AgentThinking label={"Working on it..."} />
                      )}
                      {status === "error" &&
                        messages.length === 0 &&
                        agentHasSubmitted && (
                          <p className="px-3 py-2 text-xs text-destructive">
                            The agent hit an error. Try asking again.
                          </p>
                        )}
                    </div>
                  </div>
                ) : newTaskMode ? (
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

                      {emailNavigationCommands.length > 0 && (
                        <Command.Group
                          heading="Mailbox"
                          className={commandGroupHeadingClassName}
                        >
                          {emailNavigationCommands.map((command) => (
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
                      )}

                      {taskNavigationCommands.length > 0 && (
                        <Command.Group
                          heading="Task Views"
                          className={commandGroupHeadingClassName}
                        >
                          {taskNavigationCommands.map((command) => (
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
                      )}

                      <Command.Group
                        heading="Navigation"
                        className={commandGroupHeadingClassName}
                      >
                        {visibleNavigationCommands.map((command) => (
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

                      {emailSelectionCommands.length > 0 && (
                        <Command.Group
                          heading="Select"
                          className={commandGroupHeadingClassName}
                        >
                          {emailSelectionCommands.map((command) => (
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
                      )}

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

                      {normalizedQuery ? (
                        <Command.Group
                          heading="Agent"
                          className={commandGroupHeadingClassName}
                        >
                          <Command.Item
                            forceMount
                            value={`Ask agent ${normalizedQuery}`}
                            onSelect={() => enterAgentMode(normalizedQuery)}
                            className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm transition-colors data-[selected=true]:bg-muted"
                          >
                            Ask: &ldquo;{normalizedQuery}&rdquo;
                          </Command.Item>
                        </Command.Group>
                      ) : (
                        <Command.Group
                          heading="Agent"
                          className={commandGroupHeadingClassName}
                        >
                          <Command.Item
                            forceMount
                            value="Open agent"
                            onSelect={() => enterAgentMode()}
                            className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm transition-colors data-[selected=true]:bg-muted"
                          >
                            <KeyReturnIcon className="size-4 text-muted-foreground" />
                            Open agent
                          </Command.Item>
                        </Command.Group>
                      )}
                    </Command.List>
                  </div>
                )}
              </m.div>
            )}
          </AnimatePresence>
        </LazyMotion>

        <div className="flex items-center gap-2 px-3 py-2">
          {agentMode ? (
            <>
              <input
                ref={agentInputRef}
                value={agentInput}
                onChange={(e) => setAgentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAgentSubmit();
                  }
                }}
                placeholder="Ask the agent..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={handleAgentSubmit}
                disabled={agentInput.trim().length === 0}
              >
                Send
              </Button>
            </>
          ) : (
            <Command.Input
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              onFocus={() => setOpen(true)}
              placeholder="Navigate or ask the agent..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          )}
          {!agentMode && normalizedQuery ? (
            <button
              type="button"
              className="flex items-center gap-1.5 px-2 text-xs"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => enterAgentMode(normalizedQuery)}
            >
              <KeyReturnIcon className="size-4" />
              Ask agent
            </button>
          ) : null}
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
