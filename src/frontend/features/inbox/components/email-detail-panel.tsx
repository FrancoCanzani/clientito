import { Button } from "@/components/ui/button";
import { useEmailData } from "@/features/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/inbox/hooks/use-email-inbox-actions";
import { useEmailInboxKeyboard } from "@/features/inbox/hooks/use-email-inbox-keyboard";
import { useSelectionStore } from "@/features/inbox/stores/selection-store";
import { CaretDownIcon, CaretUpIcon, XIcon } from "@phosphor-icons/react";
import { useMemo } from "react";
import type { ComposeInitial } from "./compose-email-fields";
import { EmailDetailContent } from "./email-detail-content";

export function EmailDetailPanel({
  onForward,
}: {
  onForward: (initial: ComposeInitial) => void;
}) {
  const {
    view,
    mailboxId,
    selectedEmailId,
    selectedEmail,
    displayRows,
    orderedIds,
    emailById,
  } = useEmailData();
  const selection = useSelectionStore(displayRows);
  const selectedIds = useMemo(
    () => Array.from(selection.selectedIds),
    [selection.selectedIds],
  );

  const { openEmail, closeEmail, executeEmailAction } = useEmailInboxActions({
    view,
    mailboxId,
    selectedEmailId,
    selectedIds,
    clearSelection: selection.clearSelection,
  });

  const { goToEmail, hasPrev, hasNext } = useEmailInboxKeyboard({
    orderedIds,
    selectedEmailId,
    emailById,
    openEmail,
    closeEmail,
    executeEmailAction,
  });

  if (!selectedEmail) return null;

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden border-l border-border/70 bg-background">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8">
        <EmailDetailContent
          key={selectedEmail.id}
          email={selectedEmail}
          onClose={closeEmail}
          onForward={onForward}
          headerActions={
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                disabled={!hasPrev}
                onClick={() => goToEmail("prev")}
                title="Previous"
              >
                <CaretUpIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                disabled={!hasNext}
                onClick={() => goToEmail("next")}
                title="Next"
              >
                <CaretDownIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                onClick={closeEmail}
                title="Close"
                aria-label="Close"
              >
                <XIcon className="size-4" />
              </Button>
            </>
          }
        />
      </div>
    </div>
  );
}
