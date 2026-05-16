import { AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import type { ComposerWindow } from "@/features/email/mail/compose/compose-context";
import { ComposeDockFrame } from "@/features/email/mail/compose/compose-dock-frame";
import { ComposeModalFrame } from "@/features/email/mail/compose/compose-modal-frame";

export function ComposeDock({
  composers,
  closeCompose,
  setComposerMode,
  setComposerState,
}: {
  composers: ComposerWindow[];
  closeCompose: (id: string) => void;
  setComposerMode: (id: string, mode: "modal" | "dock") => void;
  setComposerState: (id: string, state: "expanded" | "minimized") => void;
}) {
  if (typeof document === "undefined") {
    return null;
  }

  const dockComposers = composers.filter((c) => c.mode === "dock");
  const modalComposers = composers.filter((c) => c.mode === "modal");

  return createPortal(
    <>
      <div
        className="pointer-events-none fixed bottom-0 right-4 z-40 hidden flex-row-reverse items-end gap-2 sm:flex"
        aria-label="Composer dock"
      >
        <AnimatePresence>
          {dockComposers.map((composer) => (
            <ComposeDockFrame
              key={composer.id}
              initial={composer.initial}
              collapsed={composer.state === "minimized"}
              onClose={() => closeCompose(composer.id)}
              onMinimize={() => setComposerState(composer.id, "minimized")}
              onExpand={() => setComposerState(composer.id, "expanded")}
              onToggleMode={() => setComposerMode(composer.id, "modal")}
            />
          ))}
        </AnimatePresence>
      </div>

      <div className="sm:hidden">
        <AnimatePresence>
          {dockComposers.slice(-1).map((composer) => (
            <ComposeModalFrame
              key={composer.id}
              initial={composer.initial}
              onClose={() => closeCompose(composer.id)}
              onToggleMode={() => closeCompose(composer.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {modalComposers.map((composer) => (
          <ComposeModalFrame
            key={composer.id}
            initial={composer.initial}
            onClose={() => closeCompose(composer.id)}
            onToggleMode={() => setComposerMode(composer.id, "dock")}
          />
        ))}
      </AnimatePresence>
    </>,
    document.body,
  );
}
