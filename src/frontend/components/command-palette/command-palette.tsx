import { openCompose } from "@/features/inbox/components/compose-bridge";
import { cn, parseMailboxId } from "@/lib/utils";
import {
  CaretDownIcon,
  CaretRightIcon,
  KeyReturnIcon,
} from "@phosphor-icons/react";
import { Command } from "cmdk";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useRouter } from "@tanstack/react-router";
import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";
import { useCallback, useMemo } from "react";
import { AgentPanel } from "./agent-panel";
import { CommandListPanel } from "./command-list-panel";
import { NewTaskPanel } from "./new-task-panel";
import { SearchPanel } from "./search-panel";
import { Button } from "@/components/ui/button";
import { getToolName, isToolUIPart } from "ai";
import { useCommandPaletteState } from "./use-command-palette-state";
import { usePaletteCommands } from "./use-palette-commands";

function shouldIgnoreApprovalHotkeyTarget(target: EventTarget | null) {
  const element =
    target instanceof HTMLElement
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;

  if (!element) {
    return false;
  }

  if (element.isContentEditable) {
    return true;
  }

  return Boolean(element.closest("textarea, [role='textbox']"));
}

export function CommandPalette() {
  const state = useCommandPaletteState();
  const router = useRouter();
  const searchMailboxId = useMemo(() => {
    const pathname = router.state.location.pathname;
    const match = pathname.match(/^\/inbox\/([^/]+)/);
    return match ? parseMailboxId(match[1]) : undefined;
  }, [router.state.location.pathname]);
  const {
    queryClient,
    visibleNavigationCommands,
    emailNavigationCommands,
    taskNavigationCommands,
    emailSelectionCommands,
    actionCommands,
    agentSuggestions,
    submitTask,
    createTaskMutation,
  } = usePaletteCommands({ close: state.close, setMode: state.setMode });

  const normalizedQuery = state.query.trim();
  const firstPendingApproval = useMemo(() => {
    for (const message of state.messages) {
      for (const part of message.parts) {
        if (isToolUIPart(part) && part.state === "approval-requested") {
          return {
            id: part.approval.id,
            toolName: getToolName(part),
            args: part.input as Record<string, unknown>,
          };
        }
      }
    }
    return null;
  }, [state.messages]);

  const handleApprove = useCallback(
    (
      toolCallId: string,
      toolName?: string,
      args?: Record<string, unknown>,
    ) => {
      state.addToolApprovalResponse({ id: toolCallId, approved: true });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["emails"] });
      void queryClient.invalidateQueries({ queryKey: ["notes"] });

      if (toolName === "composeEmail" && args) {
        openCompose({
          mailboxId:
            typeof args.mailboxId === "number" ? args.mailboxId : undefined,
          to: args.to as string | undefined,
          subject: args.subject as string | undefined,
          bodyHtml: args.body as string | undefined,
        });
        state.close();
      }
    },
    [state.addToolApprovalResponse, state.close, queryClient],
  );

  const handleDiscard = useCallback(
    (toolCallId: string) => {
      state.addToolApprovalResponse({ id: toolCallId, approved: false });
    },
    [state.addToolApprovalResponse],
  );

  useHotkey(
    "Y",
    (event) => {
      if (
        state.mode !== "agent" ||
        !firstPendingApproval ||
        shouldIgnoreApprovalHotkeyTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      handleApprove(
        firstPendingApproval.id,
        firstPendingApproval.toolName,
        firstPendingApproval.args,
      );
    },
    { preventDefault: false, stopPropagation: false },
  );

  useHotkey(
    "N",
    (event) => {
      if (
        state.mode !== "agent" ||
        !firstPendingApproval ||
        shouldIgnoreApprovalHotkeyTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      handleDiscard(firstPendingApproval.id);
    },
    { preventDefault: false, stopPropagation: false },
  );

  return (
    <div
      ref={state.containerRef}
      className="fixed bottom-6 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-2"
    >
      <Command
        shouldFilter={state.mode !== "agent"}
        className="overflow-hidden rounded-xl border border-border bg-background shadow-lg"
      >
        <LazyMotion features={domAnimation}>
          <AnimatePresence>
            {state.open && (
              <m.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                {state.mode === "agent" ? (
                  <AgentPanel
                    messages={state.messages}
                    status={state.status}
                    isConnected={state.isConnected}
                    hasPendingApprovals={state.hasPendingApprovals}
                    agentHasSubmitted={state.agentHasSubmitted}
                    agentSuggestions={agentSuggestions}
                    messagesViewportRef={state.messagesViewportRef}
                    submitAgentMessage={state.submitAgentMessage}
                    startFreshChat={state.startFreshChat}
                    handleApprove={handleApprove}
                    handleDiscard={handleDiscard}
                  />
                ) : state.mode === "new-task" ? (
                  <NewTaskPanel
                    taskInput={state.taskInput}
                    setTaskInput={state.setTaskInput}
                    onSubmit={() => submitTask(state.taskInput)}
                    onBack={() => state.setMode("commands")}
                    isPending={createTaskMutation.isPending}
                  />
                ) : state.mode === "search" ? (
                  <SearchPanel
                    searchInput={state.searchInput}
                    setSearchInput={state.setSearchInput}
                    searchInputRef={state.searchInputRef}
                    close={state.close}
                    mailboxId={searchMailboxId}
                  />
                ) : (
                  <CommandListPanel
                    visibleNavigationCommands={visibleNavigationCommands}
                    emailNavigationCommands={emailNavigationCommands}
                    taskNavigationCommands={taskNavigationCommands}
                    emailSelectionCommands={emailSelectionCommands}
                    actionCommands={actionCommands}
                    enterAgentMode={state.enterAgentMode}
                  />
                )}
              </m.div>
            )}
          </AnimatePresence>
        </LazyMotion>

        <div className={cn("flex items-center gap-2 px-3 py-2", state.mode === "search" && "hidden")}>
          {state.mode === "agent" ? (
            <>
              <input
                ref={state.agentInputRef}
                value={state.agentInput}
                onChange={(e) => state.setAgentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    state.handleAgentSubmit();
                  }
                }}
                placeholder={
                  state.hasPendingApprovals
                    ? "Approve, discard, or describe how to revise it..."
                    : "Ask the agent..."
                }
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={state.handleAgentSubmit}
                disabled={state.agentInput.trim().length === 0}
              >
                Send
              </Button>
            </>
          ) : (
            <Command.Input
              ref={state.inputRef}
              value={state.query}
              onValueChange={state.setQuery}
              onFocus={() => state.setOpen(true)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) {
                  return;
                }

                const text = state.query.trim();
                if (!text) {
                  return;
                }

                const hasVisibleCommand = Boolean(
                  state.containerRef.current?.querySelector(
                    "[cmdk-item]:not([hidden])",
                  ),
                );

                if (hasVisibleCommand) {
                  return;
                }

                event.preventDefault();
                state.enterAgentMode(text);
              }}
              placeholder="Navigate or ask the agent..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          )}
          {state.mode !== "agent" && normalizedQuery ? (
            <button
              type="button"
              className="flex items-center gap-1.5 px-2 text-xs"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => state.enterAgentMode(normalizedQuery)}
            >
              <KeyReturnIcon className="size-4" />
              Ask agent
            </button>
          ) : null}
          {state.open ? (
            <CaretDownIcon className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
        </div>
      </Command>
    </div>
  );
}
