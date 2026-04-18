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
      return { labelIds: ["IMPORTANT"] };
    case "archived":
      return { query: "-in:inbox -in:trash -in:spam -in:drafts" };
    case "snoozed":
      return { query: "in:snoozed" };
    default:
      if (view.startsWith("Label_") || /^[A-Z_]+$/.test(view)) {
        return { labelIds: [view] };
      }
      return null;
  }
}
