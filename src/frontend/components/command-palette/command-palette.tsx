import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import {
  CaretDownIcon,
  CaretRightIcon,
  KeyReturnIcon,
} from "@phosphor-icons/react";
import { Command } from "cmdk";
import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";
import { AgentPanel } from "./agent-panel";
import { CommandListPanel } from "./command-list-panel";
import { NewTaskPanel } from "./new-task-panel";
import { useAgentInvalidation } from "./use-agent-invalidation";
import { useApprovalHandler } from "./use-approval-handler";
import { useCommandPaletteState } from "./use-command-palette-state";
import { usePaletteCommands } from "./use-palette-commands";

function CommandPaletteSurface({
  state,
  visibleNavigationCommands,
  emailNavigationCommands,
  taskNavigationCommands,
  actionCommands,
  agentSuggestions,
  submitTask,
  createTaskPending,
  handleApprove,
  handleDiscard,
}: {
  state: ReturnType<typeof useCommandPaletteState>;
  visibleNavigationCommands: ReturnType<
    typeof usePaletteCommands
  >["visibleNavigationCommands"];
  emailNavigationCommands: ReturnType<
    typeof usePaletteCommands
  >["emailNavigationCommands"];
  taskNavigationCommands: ReturnType<
    typeof usePaletteCommands
  >["taskNavigationCommands"];
  actionCommands: ReturnType<typeof usePaletteCommands>["actionCommands"];
  agentSuggestions: ReturnType<typeof usePaletteCommands>["agentSuggestions"];
  submitTask: ReturnType<typeof usePaletteCommands>["submitTask"];
  createTaskPending: boolean;
  handleApprove: ReturnType<typeof useApprovalHandler>["handleApprove"];
  handleDiscard: ReturnType<typeof useApprovalHandler>["handleDiscard"];
}) {
  const normalizedQuery = state.query.trim();

  return (
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
                  isPending={createTaskPending}
                />
              ) : (
                <CommandListPanel
                  visibleNavigationCommands={visibleNavigationCommands}
                  emailNavigationCommands={emailNavigationCommands}
                  taskNavigationCommands={taskNavigationCommands}
                  actionCommands={actionCommands}
                  enterAgentMode={state.enterAgentMode}
                />
              )}
            </m.div>
          )}
        </AnimatePresence>
      </LazyMotion>

      <div className={cn("flex items-center gap-2 px-3 py-2")}>
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
                  ? "Approve, discard, or revise..."
                  : "Ask the agent..."
              }
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {state.agentInput.trim() && (
              <button
                type="button"
                className="flex items-center gap-1.5 px-2 text-xs"
                onMouseDown={(e) => e.preventDefault()}
                onClick={state.handleAgentSubmit}
              >
                <KeyReturnIcon className="size-4" />
                Send
              </button>
            )}
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
              if (!text) return;

              const hasVisibleCommand = Boolean(
                state.containerRef.current?.querySelector(
                  "[cmdk-item]:not([hidden])",
                ),
              );

              if (hasVisibleCommand) return;

              event.preventDefault();
              state.enterAgentMode(text);
            }}
            placeholder="Navigate or ask the agent..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        )}
        {!state.open && state.mode !== "agent" && (
          <Kbd className="ml-auto shrink-0">⌘K</Kbd>
        )}
        {state.mode !== "agent" && normalizedQuery && (
          <button
            type="button"
            className="flex items-center gap-1.5 px-2 text-xs"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => state.enterAgentMode(normalizedQuery)}
          >
            <KeyReturnIcon className="size-4" />
            Ask agent
          </button>
        )}
        {state.open ? (
          <CaretDownIcon className="size-4 shrink-0 text-muted-foreground" />
        ) : state.mode === "agent" ? (
          <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
        ) : null}
      </div>
    </Command>
  );
}

export function CommandPalette() {
  const state = useCommandPaletteState();
  const {
    queryClient,
    visibleNavigationCommands,
    emailNavigationCommands,
    taskNavigationCommands,
    actionCommands,
    agentSuggestions,
    submitTask,
    createTaskMutation,
  } = usePaletteCommands({ close: state.close, setMode: state.setMode });

  useAgentInvalidation(state.status, queryClient);

  const { handleApprove, handleDiscard } = useApprovalHandler({
    messages: state.messages,
    mode: state.mode,
    addToolApprovalResponse: state.addToolApprovalResponse,
    close: state.close,
    queryClient,
  });

  const surface = (
    <CommandPaletteSurface
      state={state}
      visibleNavigationCommands={visibleNavigationCommands}
      emailNavigationCommands={emailNavigationCommands}
      taskNavigationCommands={taskNavigationCommands}
      actionCommands={actionCommands}
      agentSuggestions={agentSuggestions}
      submitTask={submitTask}
      createTaskPending={createTaskMutation.isPending}
      handleApprove={handleApprove}
      handleDiscard={handleDiscard}
    />
  );

  return (
    <div
      ref={state.containerRef}
      className={cn(
        "fixed bottom-6 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-2 transition-opacity duration-200",
        !state.open && !state.isMobile && "opacity-80 hover:opacity-100",
      )}
    >
      {surface}
    </div>
  );
}
