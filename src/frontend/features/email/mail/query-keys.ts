export type MailListFilters = {
  unread?: boolean;
  starred?: boolean;
  hasAttachment?: boolean;
};

function filterKeySegment(filters?: MailListFilters): string {
  if (!filters) return "";
  return [
    filters.unread ? "u" : "",
    filters.starred ? "s" : "",
    filters.hasAttachment ? "a" : "",
  ].join("");
}

export const emailQueryKeys = {
  all: () => ["emails"] as const,
  list: (view: string, mailboxId: number, filters?: MailListFilters) =>
    ["emails", view, mailboxId, filterKeySegment(filters)] as const,
  viewSyncMeta: (view: string, mailboxId: number) =>
    ["emails", "view-sync-meta", view, mailboxId] as const,
  inboxUnreadCount: (mailboxId: number) =>
    ["emails", "inbox-unread-count", mailboxId] as const,
  viewCounts: (mailboxId: number) =>
    ["emails", "view-counts", mailboxId] as const,
  detail: (emailId: string) => ["email-detail", emailId] as const,
  thread: (threadId: string) => ["email-thread", threadId] as const,
  calendarInvitePreview: (mailboxId: number, providerMessageId: string) =>
    ["calendar-invite-preview", mailboxId, providerMessageId] as const,
  search: {
    results: (
      query: string,
      mailboxId: number,
      view: string,
      includeJunk: boolean,
    ) => ["emails", "search", query, mailboxId, view, includeJunk] as const,
    suggestions: (
      query: string,
      mailboxId: number,
      view: string,
      includeJunk: boolean,
    ) =>
      [
        "emails",
        "search",
        "suggestions",
        query,
        mailboxId,
        view,
        includeJunk,
      ] as const,
  },
} as const;

export const draftQueryKeys = {
  list: (mailboxId: number | null): ["drafts", number | "none"] => [
    "drafts",
    mailboxId ?? "none",
  ],
} as const;

export const contactSuggestionQueryKeys = {
  list: (query: string) => ["contact-suggestions", query] as const,
} as const;

export const scheduledEmailQueryKeys = {
  all: () => ["scheduled-emails"] as const,
} as const;
