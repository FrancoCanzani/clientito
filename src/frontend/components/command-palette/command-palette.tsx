import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useMemo } from "react";
import { CommandListPanel } from "./command-list-panel";
import { MODE_LABELS } from "./modes/resolve-mode";
import type { CommandServices } from "./registry/types";
import { useAllCommands } from "./registry/use-all-commands";
import { SearchResultsPanel } from "./search-results-panel";
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

  const normalizedQuery = state.query.trim();
  const showModeIndicator = state.inputMode !== "default";

  const renderPanel = () => {
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
        hasQuery={normalizedQuery.length > 0}
      />
    );
  };

  const shouldFilter =
    state.inputMode !== "people" && state.inputMode !== "search";

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
            Search commands, people, or emails.
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
                <Command.Input
                  ref={state.inputRef}
                  value={state.query}
                  onValueChange={state.setQuery}
                  onFocus={() => state.setOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Tab") {
                      event.preventDefault();
                      const sigils = [">", "@", "#"];
                      const current = sigils.find((s) => state.query === s);
                      const next = current
                        ? sigils[(sigils.indexOf(current) + 1) % sigils.length]
                        : sigils[0];
                      state.setQuery(next);
                    }
                  }}
                  placeholder={state.inputPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
              </div>
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
                modes
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
