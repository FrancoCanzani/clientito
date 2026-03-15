import { Button } from "@/components/ui/button";
import { MinusIcon, XIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ComposeEmailFields,
  type ComposeInitial,
} from "./compose-email-dialog";
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

  const title = useMemo(() => {
    const subject = compose.subject.trim();
    if (subject.length > 0) {
      return subject;
    }

    return initial?.subject?.startsWith("Fwd:") ? "Forward" : "New message";
  }, [compose.subject, initial?.subject]);

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-50 px-0 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-120 sm:px-0">
      <div className="flex max-h-[min(85vh,720px)] min-h-0 flex-col overflow-hidden rounded-t-xl border border-border/80 bg-background shadow-2xl sm:rounded-xl">
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-muted/30 px-4 py-3"
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
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{title}</p>
            {!minimized && (
              <p className="text-xs text-muted-foreground">
                Press Cmd+Enter to send
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={(event) => {
                event.stopPropagation();
                setMinimized((current) => !current);
              }}
              aria-label={minimized ? "Expand compose" : "Minimize compose"}
            >
              <MinusIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={(event) => {
                event.stopPropagation();
                onOpenChange(false);
              }}
              aria-label="Close compose"
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        </div>

        {!minimized && (
          <div className="flex min-h-0 flex-1 px-4 py-4">
            <ComposeEmailFields
              compose={compose}
              bodyClassName="min-h-[220px] flex-1 resize-none overflow-y-auto text-sm [field-sizing:fixed]"
              onEscape={() => onOpenChange(false)}
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
