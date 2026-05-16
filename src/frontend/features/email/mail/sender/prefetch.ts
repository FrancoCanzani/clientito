import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { queryClient } from "@/lib/query-client";
import { SENDER_STATS_WINDOW_MS, senderQueryKeys } from "@/features/email/mail/sender/query-keys";

const inFlight = new Set<string>();

export async function prefetchSender(
  mailboxId: number | null | undefined,
  fromAddr: string | null | undefined,
) {
  const normalized = (fromAddr ?? "").trim().toLowerCase();
  if (!normalized || mailboxId == null) return;
  const key = `${mailboxId}:${normalized}`;
  if (inFlight.has(key)) return;
  inFlight.add(key);

  try {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: senderQueryKeys.stats(mailboxId, normalized),
        queryFn: () =>
          localDb.getSenderStats({
            userId,
            mailboxId,
            fromAddr: normalized,
            sinceMs: Date.now() - SENDER_STATS_WINDOW_MS,
          }),
        staleTime: 30_000,
      }),
      queryClient.prefetchQuery({
        queryKey: senderQueryKeys.recent(mailboxId, normalized),
        queryFn: () =>
          localDb.getSenderRecentThreads({
            userId,
            mailboxId,
            fromAddr: normalized,
            limit: 5,
          }),
        staleTime: 30_000,
      }),
    ]);
  } finally {
    inFlight.delete(key);
  }
}
