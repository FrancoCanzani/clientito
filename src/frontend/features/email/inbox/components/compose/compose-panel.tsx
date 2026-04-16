import { Button } from "@/components/ui/button";
import { ArrowsOutSimpleIcon, XIcon } from "@phosphor-icons/react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { createPortal } from "react-dom";
import type { ComposeInitial } from "../../types";
import { ComposeEmailFields } from "./compose-email-fields";
import { getComposePanelKey, useComposeEmail } from "./compose-email-state";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

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
  const navigate = useNavigate();
  const { mailboxId } = mailboxRoute.useParams();
  const compose = useComposeEmail(initial, {
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

  const handleOpenFullComposer = async () => {
    const handoffComposeKey = `compose_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const composeKey = await compose.saveDraftNow(handoffComposeKey);
    // Move the draft from the panel key to the full-page key so reopening
    // the small composer starts clean.
    await compose.clearDraft();
    onOpenChange(false);
    navigate({
      to: "/$mailboxId/inbox/new",
      params: { mailboxId },
      search: { composeKey },
    });
  };

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
        <div className="flex max-h-[min(85vh,720px)] min-h-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-background shadow-2xl sm:max-h-[70vh]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 px-3 py-2">
            <h3 className="text-xs font-medium">{title}</h3>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  void handleOpenFullComposer();
                }}
                aria-label="Open full composer"
                title="Open full composer"
              >
                <ArrowsOutSimpleIcon className="size-3" />
              </Button>
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
