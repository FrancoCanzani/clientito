import { IconButton } from "@/components/ui/icon-button";
import type { EmailInboxAction } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import type { ThreadGroup } from "@/features/email/inbox/utils/group-emails-by-thread";
import { LabelPicker } from "@/features/email/labels/components/label-picker";
import { queryKeys } from "@/lib/query-keys";
import {
  ArchiveIcon,
  EnvelopeSimpleIcon,
  EnvelopeSimpleOpenIcon,
  StarIcon,
  TagIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

type Props = {
  selectedIds: string[];
  groups: ThreadGroup[];
  view: string;
  mailboxId: number;
  onAction: (action: EmailInboxAction, ids?: string[]) => void;
  onClear: () => void;
};

export function SelectionActions({
  selectedIds,
  groups,
  view,
  mailboxId,
  onAction,
}: Props) {
  const queryClient = useQueryClient();

  const selectedEmails = useMemo(() => {
    const byId = new Map(groups.map((g) => [g.representative.id, g.representative]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((email): email is NonNullable<typeof email> => !!email);
  }, [groups, selectedIds]);

  const allRead = selectedEmails.length > 0 && selectedEmails.every((e) => e.isRead);
  const allStarred =
    selectedEmails.length > 0 &&
    selectedEmails.every((e) => e.labelIds.includes("STARRED"));
  const inTrashOrArchive = view === "trash" || view === "archived";

  const providerMessageIds = useMemo(
    () => selectedEmails.map((e) => e.providerMessageId),
    [selectedEmails],
  );

  const appliedLabelIds = useMemo(() => {
    if (selectedEmails.length === 0) return [];
    const counts = new Map<string, number>();
    for (const email of selectedEmails) {
      for (const id of email.labelIds) {
        if (!id.startsWith("Label_")) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count === selectedEmails.length)
      .map(([id]) => id);
  }, [selectedEmails]);

  const invalidateEmails = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });
  };

  return (
    <div className="flex items-center gap-0.5">
      <IconButton
        label={inTrashOrArchive ? "Move to inbox" : "Archive"}
        variant="ghost"
        onClick={() =>
          onAction(inTrashOrArchive ? "move-to-inbox" : "archive", selectedIds)
        }
      >
        <ArchiveIcon className="size-3.5" />
      </IconButton>

      <IconButton
        label={view === "trash" ? "Delete forever" : "Move to trash"}
        variant="ghost"
        onClick={() =>
          onAction(view === "trash" ? "delete-forever" : "trash", selectedIds)
        }
      >
        <TrashIcon className="size-3.5" />
      </IconButton>

      <IconButton
        label={allRead ? "Mark as unread" : "Mark as read"}
        variant="ghost"
        onClick={() => onAction(allRead ? "mark-unread" : "mark-read", selectedIds)}
      >
        {allRead ? (
          <EnvelopeSimpleIcon className="size-3.5" />
        ) : (
          <EnvelopeSimpleOpenIcon className="size-3.5" />
        )}
      </IconButton>

      <IconButton
        label={allStarred ? "Unstar" : "Star"}
        variant="ghost"
        onClick={() => onAction(allStarred ? "unstar" : "star", selectedIds)}
      >
        <StarIcon
          className="size-3.5"
          weight={allStarred ? "fill" : "regular"}
        />
      </IconButton>

      <LabelPicker
        mailboxId={mailboxId}
        emailIds={providerMessageIds}
        appliedLabelIds={appliedLabelIds}
        onDone={invalidateEmails}
        trigger={
          <IconButton label="Label" variant="ghost">
            <TagIcon className="size-3.5" />
          </IconButton>
        }
      />

      {view !== "spam" && (
        <IconButton
          label="Move to spam"
          variant="ghost"
          onClick={() => onAction("spam", selectedIds)}
        >
          <WarningIcon className="size-3.5" />
        </IconButton>
      )}
    </div>
  );
}
