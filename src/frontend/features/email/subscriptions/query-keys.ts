export const subscriptionQueryKeys = {
  senders: (mailboxId: number) =>
    ["subscriptions", "senders", mailboxId] as const,
} as const;