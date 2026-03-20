import { openCompose } from "@/features/inbox/compose-bridge";
import {
  CaretDownIcon,
  CaretRightIcon,
  KeyReturnIcon,
} from "@phosphor-icons/react";
import { Command } from "cmdk";
import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";
import { useCallback } from "react";
import { AgentPanel } from "./agent-panel";
import { CommandListPanel } from "./command-list-panel";
import { NewTaskPanel } from "./new-task-panel";
import { Button } from "@/components/ui/button";
import { useCommandPaletteState } from "./use-command-palette-state";
import { usePaletteCommands } from "./use-palette-commands";

export function CommandPalette() {
  const state = useCommandPaletteState();
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
          to: args.to as string | undefined,
          subject: args.subject as string | undefined,
          body: args.body as string | undefined,
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
                ) : (
                  <CommandListPanel
                    visibleNavigationCommands={visibleNavigationCommands}
                    emailNavigationCommands={emailNavigationCommands}
                    taskNavigationCommands={taskNavigationCommands}
                    emailSelectionCommands={emailSelectionCommands}
                    actionCommands={actionCommands}
                    normalizedQuery={normalizedQuery}
                    enterAgentMode={state.enterAgentMode}
                  />
                )}
              </m.div>
            )}
          </AnimatePresence>
        </LazyMotion>

        <div className="flex items-center gap-2 px-3 py-2">
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
                    ? "Approve or discard the pending action first..."
                    : "Ask the agent..."
                }
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                disabled={state.hasPendingApprovals}
              />
              <Button
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={state.handleAgentSubmit}
                disabled={
                  state.hasPendingApprovals ||
                  state.agentInput.trim().length === 0
                }
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
