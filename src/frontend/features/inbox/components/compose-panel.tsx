import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
  MinusIcon,
  XIcon,
} from "@phosphor-icons/react";
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

type ComposeMode = "minimized" | "normal" | "expanded";

function ComposePanelBody({
  onOpenChange,
  initial,
}: {
  onOpenChange: (open: boolean) => void;
  initial?: ComposeInitial;
}) {
  const [mode, setMode] = useState<ComposeMode>("normal");
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

  const headerButtons = (
    <div className="flex shrink-0 items-center gap-0.5">
      {mode === "expanded" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden sm:inline-flex"
          onClick={() => setMode("normal")}
          aria-label="Shrink compose"
        >
          <ArrowsInSimpleIcon size={14} />
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden sm:inline-flex"
          onClick={() => setMode("expanded")}
          aria-label="Expand compose"
        >
          <ArrowsOutSimpleIcon size={14} />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hidden sm:inline-flex"
        onClick={() => setMode("minimized")}
        aria-label="Minimize compose"
      >
        <MinusIcon className="size-3" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleClose}
        aria-label="Close compose"
      >
        <XIcon className="size-3" />
      </Button>
    </div>
  );

  const composeFields = (
    <div className="flex min-h-0 flex-1">
      <ComposeEmailFields
        compose={compose}
        bodyClassName="min-h-50 text-sm leading-relaxed"
        onEscape={handleClose}
        recipientAutoFocus={!hasInitialRecipient}
        editorAutoFocus={hasInitialRecipient}
      />
    </div>
  );

  if (mode === "minimized") {
    return createPortal(
      <div className="fixed right-6 bottom-6 z-50 hidden sm:block">
        <div className="flex w-72 items-center justify-between gap-3 rounded-xl border border-border/50 bg-background px-3 py-2 shadow-xl">
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-xs font-medium outline-none"
            onClick={() => setMode("normal")}
          >
            {title}
          </button>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMode("normal")}
              aria-label="Open compose"
            >
              <ArrowsOutSimpleIcon size={14} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label="Close compose"
            >
              <XIcon className="size-3" />
            </Button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  if (mode === "expanded") {
    return createPortal(
      <>
        <div
          className="fixed inset-0 z-50 hidden bg-black/25 sm:block"
          onClick={() => setMode("normal")}
        />
        <div
          className={cn(
            "fixed z-50 antialiased",
            "inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
            "sm:w-[640px]",
          )}
        >
          <div className="flex max-h-[min(85vh,720px)] min-h-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-background shadow-2xl sm:max-h-[70vh]">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 px-3 py-2">
              <h3 className="text-xs font-medium">{title}</h3>
              {headerButtons}
            </div>
            {composeFields}
          </div>
        </div>
      </>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-50 px-0 antialiased sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-120 sm:px-0">
      <div className="flex max-h-[min(85vh,720px)] min-h-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-background shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 px-3 py-2">
          <h3 className="text-xs font-medium">{title}</h3>
          {headerButtons}
        </div>
        {composeFields}
      </div>
    </div>,
    document.body,
  );
}
