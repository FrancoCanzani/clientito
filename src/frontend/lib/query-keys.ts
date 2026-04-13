export const queryKeys = {
  emails: {
    all: () => ["emails"] as const,
    list: (view: string, mailboxId: number) =>
      ["emails", view, mailboxId] as const,
    detail: (emailId: string) => ["email-detail", emailId] as const,
    thread: (threadId: string) => ["email-thread", threadId] as const,
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
  subscriptions: () => ["subscriptions"] as const,
  subscriptionSuggestions: () => ["subscription-suggestions"] as const,
  accounts: () => ["accounts"] as const,
  syncStatus: () => ["sync-status"] as const,
  contactSuggestions: (query: string) =>
    ["contact-suggestions", query] as const,
  scheduledEmails: () => ["scheduled-emails"] as const,
} as const;
