import { useMemo } from "react";
import type { ComposeInitial } from "../types";
import { ComposeEmailFields } from "./compose-email-fields";
import { useComposeEmail } from "./compose-email-state";
import { ComposeShell } from "./compose-shell";

export type ComposeBodyProps = {
  initial?: ComposeInitial;
  onClose: () => void;
  onMinimize?: () => void;
  onToggleMode?: () => void;
  mode: "modal" | "dock";
  collapsed?: boolean;
  onExpand?: () => void;
  bodyClassName?: string;
  containerClassName?: string;
};

export function ComposeBody({
  initial,
  onClose,
  onMinimize,
  onToggleMode,
  mode,
  collapsed = false,
  onExpand,
  bodyClassName,
  containerClassName,
}: ComposeBodyProps) {
  const compose = useComposeEmail(initial, {
    onQueued: () => onClose(),
    onSent: () => onClose(),
  });
  const hasInitialRecipient = (initial?.to?.trim().length ?? 0) > 0;

  const handleDiscard = async () => {
    await compose.clearDraft();
    onClose();
  };

  const title = useMemo(() => {
    const subject = compose.subject.trim();
    if (subject.length > 0) {
      return subject;
    }
    return initial?.subject?.startsWith("Fwd:") ? "Forward" : "New message";
  }, [compose.subject, initial?.subject]);

  return (
    <ComposeShell
      title={title}
      draftStatus={compose.draftStatus}
      onClose={onClose}
      onMinimize={onMinimize}
      onToggleMode={onToggleMode}
      mode={mode}
      collapsed={collapsed}
      onHeaderClick={collapsed ? onExpand : undefined}
      containerClassName={containerClassName}
    >
      <div className="flex min-h-0 flex-1">
        <ComposeEmailFields
          compose={compose}
          bodyClassName={bodyClassName ?? "min-h-50 text-sm leading-relaxed"}
          onEscape={onClose}
          onDiscard={() => {
            void handleDiscard();
          }}
          recipientAutoFocus={!hasInitialRecipient}
          editorAutoFocus={hasInitialRecipient}
        />
      </div>
    </ComposeShell>
  );
}
