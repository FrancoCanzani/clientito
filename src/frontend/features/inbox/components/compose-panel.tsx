import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MinusIcon, XIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ComposeInitial } from "../types";
import { ComposeEmailFields } from "./compose-email-fields";
import { getComposeInitialKey, useComposeEmail } from "./compose-email-state";

export function ComposePanel({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ComposeInitial;
}) {
  const composeKey = getComposeInitialKey(initial);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return (
    <ComposePanelBody
      key={composeKey}
      onOpenChange={onOpenChange}
      initial={initial}
    />
  );
}

function ComposePanelBody({
  onOpenChange,
  initial,
}: {
  onOpenChange: (open: boolean) => void;
  initial?: ComposeInitial;
}) {
  const [minimized, setMinimized] = useState(false);
  const compose = useComposeEmail(initial, {
    onSent: () => onOpenChange(false),
  });
  const hasInitialRecipient = (initial?.to?.trim().length ?? 0) > 0;

  const handleClose = () => {
    compose.clearDraft();
    onOpenChange(false);
  };

  const title = useMemo(() => {
    const subject = compose.subject.trim();
    if (subject.length > 0) {
      return subject;
    }

    return initial?.subject?.startsWith("Fwd:") ? "Forward" : "New message";
  }, [compose.subject, initial?.subject]);

  return createPortal(
    <div
      className={cn(
        "fixed antialiased inset-x-0 bottom-0 z-50 px-0 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-120 sm:px-0",
        minimized && "w-72!",
      )}
    >
      <div className="flex max-h-[min(85vh,720px)] min-h-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-background shadow-xl">
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 px-2 py-1"
          role="button"
          tabIndex={0}
          onClick={() => setMinimized(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setMinimized(false);
            }
          }}
        >
          <h3 className="text-xs font-medium">{title}</h3>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              onClick={(event) => {
                event.stopPropagation();
                setMinimized((current) => !current);
              }}
              aria-label={minimized ? "Expand compose" : "Minimize compose"}
            >
              <MinusIcon className="size-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(event) => {
                event.stopPropagation();
                handleClose();
              }}
              aria-label="Close compose"
            >
              <XIcon className="size-3" />
            </Button>
          </div>
        </div>

        {!minimized && (
          <div className="flex min-h-0 flex-1">
            <ComposeEmailFields
              compose={compose}
              bodyClassName="min-h-50 text-sm leading-relaxed"
              onEscape={handleClose}
              recipientAutoFocus={!hasInitialRecipient}
              editorAutoFocus={hasInitialRecipient}
            />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
