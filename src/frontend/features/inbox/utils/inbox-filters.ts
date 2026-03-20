export const VIEW_VALUES = ["inbox", "sent", "spam", "trash", "snoozed", "archived", "starred"] as const;

export type EmailView = (typeof VIEW_VALUES)[number];

export const VIEW_LABELS: Record<EmailView, string> = {
  inbox: "Inbox",
  sent: "Sent",
  spam: "Spam",
  trash: "Trash",
  snoozed: "Snoozed",
  archived: "Archived",
  starred: "Starred",
};
