import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useMemo } from "react";
import { AgentPanel } from "./agent-panel";
import { CommandListPanel } from "./command-list-panel";
import { MODE_LABELS } from "./modes/resolve-mode";
import type { CommandServices } from "./registry/types";
import { useAllCommands } from "./registry/use-all-commands";
import { SearchResultsPanel } from "./search-results-panel";
import { useAgentInvalidation } from "./use-agent-invalidation";
import { useApprovalHandler } from "./use-approval-handler";
import { useCommandPaletteState } from "./use-command-palette-state";

export function CommandPalette() {
  const state = useCommandPaletteState();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { commands, ctx } = useAllCommands();

  const services: CommandServices = useMemo(
    () => ({
      queryClient,
      navigate,
      close: state.close,
    }),
    [queryClient, navigate, state.close],
  );

  useAgentInvalidation(state.status, queryClient);

  const { handleApprove, handleDiscard } = useApprovalHandler({
    addToolApprovalResponse: state.addToolApprovalResponse,
    close: state.close,
    queryClient,
  });

  const normalizedQuery = state.query.trim();
  const showModeIndicator =
    state.inputMode !== "default" && state.mode !== "agent";

  const renderPanel = () => {
    if (state.mode === "agent") {
      return (
        <AgentPanel
          messages={state.messages}
          status={state.status}
          isConnected={state.isConnected}
          hasPendingApprovals={state.hasPendingApprovals}
          agentHasSubmitted={state.agentHasSubmitted}
          agentSuggestions={state.agentSuggestions}
          messagesViewportRef={state.messagesViewportRef}
          submitAgentMessage={state.submitAgentMessage}
          startFreshChat={state.startFreshChat}
          handleApprove={handleApprove}
          handleDiscard={handleDiscard}
        />
      );
    }

    if (state.inputMode === "people" || state.inputMode === "search") {
      return (
        <SearchResultsPanel
          mode={state.inputMode}
          query={state.modeQuery}
          ctx={ctx}
          services={services}
        />
      );
    }

    return (
      <CommandListPanel
        commands={commands}
        ctx={ctx}
        services={services}
        enterAgentMode={state.enterAgentMode}
        hasQuery={normalizedQuery.length > 0}
      />
    );
  };

  // Disable cmdk filtering for modes that handle their own search
  const shouldFilter =
    state.mode !== "agent" &&
    state.inputMode !== "people" &&
    state.inputMode !== "search";

  return (
    <DialogPrimitive.Root
      open={state.open}
      onOpenChange={(open) => {
        if (open) {
          state.setOpen(true);
          return;
        }
        state.close();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          ref={state.containerRef}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (state.mode === "agent") {
              event.preventDefault();
              state.setMode("commands");
            }
          }}
          className={cn(
            "fixed left-1/2 top-4 z-50 w-[calc(100vw-1rem)] max-w-lg -translate-x-1/2 outline-none sm:top-[14vh]",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:slide-in-from-top-2",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:slide-out-to-top-2",
            "duration-150",
            state.isMobile ? "max-w-none" : "",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            Command palette
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search commands, people, emails, or ask the agent.
          </DialogPrimitive.Description>

          <Command
            shouldFilter={shouldFilter}
            className="flex max-h-[min(72vh,40rem)] min-h-0 flex-col overflow-hidden rounded-md border border-border bg-background shadow-xl"
          >
            <div className="border-b border-border px-3 py-2">
              <div className="flex items-center gap-2">
                {showModeIndicator && (
                  <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {MODE_LABELS[state.inputMode]}
                  </span>
                )}
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
                      placeholder={state.inputPlaceholder}
                      className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                    />
                    {state.agentInput.trim() && (
                      <button
                        type="button"
                        className="flex shrink-0 items-center rounded-sm px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={state.handleAgentSubmit}
                      >
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
                      if (event.key === "Tab") {
                        event.preventDefault();
                        const sigils = [">", "@", "#", "/"] as const;
                        const current = sigils.find((s) => state.query === s);
                        const next = current
                          ? sigils[(sigils.indexOf(current) + 1) % sigils.length]
                          : sigils[0];
                        state.setQuery(next);
                        return;
                      }

                      if (event.key !== "Enter" || event.nativeEvent.isComposing) {
                        return;
                      }

                      const text = state.query.trim();
                      if (!text) return;

                      if (state.inputMode === "agent") {
                        event.preventDefault();
                        state.enterAgentMode(state.modeQuery);
                        return;
                      }

                      if (
                        state.inputMode === "people" ||
                        state.inputMode === "search"
                      ) {
                        return;
                      }

                      const hasVisibleCommand = Boolean(
                        state.containerRef.current?.querySelector(
                          "[cmdk-item]:not([hidden])",
                        ),
                      );

                      if (hasVisibleCommand) return;

                      event.preventDefault();
                      state.enterAgentMode(text);
                    }}
                    placeholder={state.inputPlaceholder}
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                  />
                )}
                {state.mode !== "agent" &&
                  normalizedQuery &&
                  state.inputMode !== "agent" && (
                    <button
                      type="button"
                      className="hidden shrink-0 items-center rounded-sm px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => state.enterAgentMode(normalizedQuery)}
                    >
                      Ask agent
                    </button>
                  )}
              </div>
              {state.mode !== "agent" && normalizedQuery && (
                <div className="mt-1.5 px-0.5 text-[10px] text-muted-foreground">
                  Use <span className="font-mono">&gt;</span> commands,{" "}
                  <span className="font-mono">@</span> contacts,{" "}
                  <span className="font-mono">#</span> emails,{" "}
                  <span className="font-mono">/</span> agent
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 bg-card">
              {renderPanel()}
            </div>

            <div className="flex items-center gap-4 border-t border-border px-3 py-2">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <kbd className="font-sans">↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <kbd className="font-sans">↵</kbd> select
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <kbd className="font-sans">esc</kbd> close
              </span>
              <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                <kbd className="font-mono">&gt;</kbd>
                <kbd className="font-mono">@</kbd>
                <kbd className="font-mono">#</kbd>
                <kbd className="font-mono">/</kbd>
                modes
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
