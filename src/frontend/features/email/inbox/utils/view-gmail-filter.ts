/**
 * Maps an in-app view (folder, label id, etc.) to the Gmail filter used to
 * back-fill that view from the API. `null` means there is no Gmail-side
 * equivalent (e.g. local snooze state) and remote backfill should be skipped.
 */
export type ViewGmailFilter = {
  labelIds?: string[];
  query?: string;
};

export function viewToGmailFilter(view: string): ViewGmailFilter | null {
  switch (view) {
    case "inbox":
      return { labelIds: ["INBOX"] };
    case "sent":
      return { labelIds: ["SENT"] };
    case "spam":
      return { labelIds: ["SPAM"] };
    case "trash":
      return { labelIds: ["TRASH"] };
    case "starred":
      return { labelIds: ["STARRED"] };
    case "important":
      return { labelIds: ["IMPORTANT"] };
    case "archived":
      return { query: "-in:inbox -in:trash -in:spam -in:drafts" };
    case "snoozed":
      // Snooze state is local-only; no Gmail-side filter to backfill from.
      return null;
    default:
      // User-created labels from Gmail use opaque IDs (e.g. "Label_123").
      if (view.startsWith("Label_") || /^[A-Z_]+$/.test(view)) {
        return { labelIds: [view] };
      }
      return null;
  }
}
