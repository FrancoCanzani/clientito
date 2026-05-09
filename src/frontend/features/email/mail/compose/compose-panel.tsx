import { Button } from "@/components/ui/button";
import { XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { createPortal } from "react-dom";
import type { DraftStatus } from "../hooks/use-draft";
import type { ComposeInitial } from "../types";
import { ComposeEmailFields } from "./compose-email-fields";
import { getComposePanelKey, useComposeEmail } from "./compose-email-state";

function DraftStatusIndicator({ status }: { status: DraftStatus }) {
  if (status !== "saved") return null;
  return <span className="text-[10px] text-muted-foreground">Saved</span>;
}

export function ComposePanel({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ComposeInitial;
}) {
  const composeKey = getComposePanelKey(initial);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <ComposePanelBody
          key={composeKey}
          onOpenChange={onOpenChange}
          initial={initial}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}

function ComposePanelBody({
  onOpenChange,
  initial,
}: {
  onOpenChange: (open: boolean) => void;
  initial?: ComposeInitial;
}) {
  const compose = useComposeEmail(initial, {
    onQueued: () => onOpenChange(false),
    onSent: () => onOpenChange(false),
  });
  const hasInitialRecipient = (initial?.to?.trim().length ?? 0) > 0;

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleDiscard = async () => {
    await compose.clearDraft();
    onOpenChange(false);
  };

  const title = useMemo(() => {
    const subject = compose.subject.trim();
    if (subject.length > 0) {
      return subject;
    }

    return initial?.subject?.startsWith("Fwd:") ? "Forward" : "New message";
  }, [compose.subject, initial?.subject]);

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 bg-[oklch(12%_0.01_250)]/25"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={() => {
          handleClose();
        }}
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-50 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-160"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15 }}
      >
        <div className="flex max-h-[min(85vh,720px)] min-h-0 flex-col overflow-hidden border border-border/40 bg-card shadow-2xl sm:max-h-[70vh]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 px-3 py-2">
            <div className="min-w-0">
              <h3 className="truncate text-xs font-medium">{title}</h3>
            </div>
            <div className="flex items-center gap-2">
              <DraftStatusIndicator status={compose.draftStatus} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  handleClose();
                }}
                aria-label="Close compose"
              >
                <XIcon className="size-3" />
              </Button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1">
            <ComposeEmailFields
              compose={compose}
              bodyClassName="min-h-50 text-sm leading-relaxed"
              onEscape={() => {
                handleClose();
              }}
              onDiscard={() => {
                void handleDiscard();
              }}
              recipientAutoFocus={!hasInitialRecipient}
              editorAutoFocus={hasInitialRecipient}
            />
          </div>
        </div>
      </motion.div>
    </>
  );
}
