export type GmailViewFilter = {
  labelIds?: string[];
  query?: string;
};

export function viewToGmailFilter(view: string): GmailViewFilter | null {
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
      return { labelIds: ["INBOX", "IMPORTANT"] };
    case "archived":
      // Keep this predicate in lockstep with the local "archived"/Done view.
      // If Gmail returns sent mail here, sync can spend the first page on rows
      // that SQLite correctly hides from Done, leaving the screen looking stale.
      return { query: "-in:inbox -in:sent -in:trash -in:spam -in:drafts" };
    default:
      if (view.startsWith("Label_") || /^[A-Z_]+$/.test(view)) {
        return { labelIds: [view] };
      }
      return null;
  }
}
