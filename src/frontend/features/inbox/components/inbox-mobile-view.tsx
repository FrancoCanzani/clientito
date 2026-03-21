import { useEmailData } from "@/features/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/inbox/hooks/use-email-inbox-actions";
import { useSelectionStore } from "@/features/inbox/stores/selection-store";
import { useMemo } from "react";
import type { ComposeInitial } from "./compose-email-fields";
import { EmailDetailSheet } from "./email-detail-sheet";
import { EmailList } from "./email-list";

export function InboxMobileView({
  onForward,
}: {
  onForward: (initial: ComposeInitial) => void;
}) {
  const { view, mailboxId, selectedEmailId, selectedEmail, displayRows } =
    useEmailData();
  const selection = useSelectionStore(displayRows);
  const selectedIds = useMemo(
    () => Array.from(selection.selectedIds),
    [selection.selectedIds],
  );

  const { closeEmail } = useEmailInboxActions({
    view,
    mailboxId,
    selectedEmailId,
    selectedIds,
    clearSelection: selection.clearSelection,
  });

  return (
    <>
      <EmailList />
      <EmailDetailSheet
        email={selectedEmail}
        open={selectedEmail !== null}
        onOpenChange={(open) => {
          if (!open) closeEmail();
        }}
        onForward={onForward}
      />
    </>
  );
}
