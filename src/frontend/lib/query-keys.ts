export const queryKeys = {
  emails: {
    baseScope: "__base__",
    all: () => ["emails"] as const,
    list: (view: string, mailboxId: number) => ["emails", view, mailboxId] as const,
    listScoped: (view: string, mailboxId: number, scope: string) =>
      ["emails", view, mailboxId, scope] as const,
    listBase: (view: string, mailboxId: number) =>
      ["emails", view, mailboxId, "__base__"] as const,
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
  },
  drafts: (mailboxId: number | null): ["drafts", number | "none"] => [
    "drafts",
    mailboxId ?? "none",
  ],
  labels: (mailboxId: number) => ["labels", mailboxId] as const,
  splitViews: () => ["split-views"] as const,
  gatekeeper: {
    pending: (mailboxId: number) => ["gatekeeper", "pending", mailboxId] as const,
  },
  accounts: () => ["accounts"] as const,
  contactSuggestions: (query: string) =>
    ["contact-suggestions", query] as const,
  scheduledEmails: () => ["scheduled-emails"] as const,
} as const;
