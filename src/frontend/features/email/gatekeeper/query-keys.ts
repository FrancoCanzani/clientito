export const gatekeeperQueryKeys = {
 pending: (mailboxId: number) => ["gatekeeper", "pending", mailboxId] as const,
} as const;
