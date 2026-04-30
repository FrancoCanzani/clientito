export const emailQueryKeys = {
  baseScope: "__base__",
  all: () => ["emails"] as const,
  list: (view: string, mailboxId: number) => ["emails", view, mailboxId] as const,
  listScoped: (view: string, mailboxId: number, scope: string) =>
    ["emails", view, mailboxId, scope] as const,
  listBase: (view: string, mailboxId: number) =>
    ["emails", view, mailboxId, "__base__"] as const,
  inboxUnreadCount: (mailboxId: number) =>
    ["emails", "inbox-unread-count", mailboxId] as const,
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
