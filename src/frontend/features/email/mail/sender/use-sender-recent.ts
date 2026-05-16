import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { useQuery } from "@tanstack/react-query";
import { senderQueryKeys } from "@/features/email/mail/sender/query-keys";

const RECENT_LIMIT = 5;

export function useSenderRecent(
  mailboxId: number | null | undefined,
  fromAddr: string | null | undefined,
  enabled = true,
) {
  const normalized = (fromAddr ?? "").trim().toLowerCase();
  const isEnabled = enabled && !!normalized && mailboxId != null;

  return useQuery({
    queryKey: senderQueryKeys.recent(mailboxId ?? -1, normalized),
    queryFn: async () => {
      const userId = await getCurrentUserId();
      if (!userId || mailboxId == null) return [];
      return localDb.getSenderRecentThreads({
        userId,
        mailboxId,
        fromAddr: normalized,
        limit: RECENT_LIMIT,
      });
    },
    enabled: isEnabled,
    staleTime: 30_000,
  });
}
