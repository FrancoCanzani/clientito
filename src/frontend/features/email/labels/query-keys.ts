export const labelQueryKeys = {
 list: (mailboxId: number) => ["labels", mailboxId] as const,
} as const;
