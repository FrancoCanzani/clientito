export const SENDER_STATS_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export const senderQueryKeys = {
  all: () => ["sender"] as const,
  stats: (mailboxId: number, fromAddr: string) =>
    ["sender", "stats", mailboxId, fromAddr] as const,
  recent: (mailboxId: number, fromAddr: string) =>
    ["sender", "recent", mailboxId, fromAddr] as const,
};
