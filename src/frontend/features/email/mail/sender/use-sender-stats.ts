import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { useQuery } from "@tanstack/react-query";
import { senderQueryKeys, SENDER_STATS_WINDOW_MS } from "@/features/email/mail/sender/query-keys";

export function useSenderStats(
  mailboxId: number | null | undefined,
  fromAddr: string | null | undefined,
  enabled = true,
) {
  const normalized = (fromAddr ?? "").trim().toLowerCase();
  const isEnabled = enabled && !!normalized && mailboxId != null;

  return useQuery({
    queryKey: senderQueryKeys.stats(mailboxId ?? -1, normalized),
    queryFn: async () => {
      const userId = await getCurrentUserId();
      if (!userId || mailboxId == null) {
        return { count: 0, firstSeenAt: null, lastSeenAt: null };
      }
      return localDb.getSenderStats({
        userId,
        mailboxId,
        fromAddr: normalized,
        sinceMs: Date.now() - SENDER_STATS_WINDOW_MS,
      });
    },
    enabled: isEnabled,
    staleTime: 30_000,
  });
}
