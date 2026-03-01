export const TAB_VALUES = [
  "all",
  "primary",
  "promotions",
  "social",
  "notifications",
] as const;

export type InboxFilterTab = (typeof TAB_VALUES)[number];

export const FILTER_TABS: Array<{ key: InboxFilterTab; label: string }> = [
  { key: "all", label: "All" },
  { key: "primary", label: "Principal" },
  { key: "promotions", label: "Promotions" },
  { key: "social", label: "Social" },
  { key: "notifications", label: "Notifications" },
];

export function getCategoryFromTab(tab: InboxFilterTab) {
  switch (tab) {
    case "all":
      return undefined;
    case "primary":
    case "promotions":
    case "social":
    case "notifications":
      return tab;
  }
}

export function isInboxFilterTab(value: string): value is InboxFilterTab {
  return FILTER_TABS.some((tab) => tab.key === value);
}

export const VIEW_VALUES = [
  "inbox",
  "sent",
  "spam",
  "trash",
  "all",
] as const;

export type EmailView = (typeof VIEW_VALUES)[number];

export const VIEW_LABELS: Record<EmailView, string> = {
  inbox: "Inbox",
  sent: "Sent",
  spam: "Spam",
  trash: "Trash",
  all: "All Mail",
};
