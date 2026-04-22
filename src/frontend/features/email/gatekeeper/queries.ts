import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import type { EmailListItem } from "@/features/email/inbox/types";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";

export type GatekeeperPendingState = {
  pendingCount: number;
  items: EmailListItem[];
};

type GatekeeperDecision = "accept" | "reject";

export type GatekeeperDecisionResult = {
  fromAddr: string;
  trustLevel: "trusted" | "blocked";
  decision: GatekeeperDecision;
  providerBlocked: boolean;
  trashedCount: number;
  providerError: string | null;
  requiresReconnect: boolean;
};

export async function fetchGatekeeperPending(
  mailboxId: number,
  limit = 30,
): Promise<GatekeeperPendingState> {
  const userId = await getCurrentUserId();
  if (!userId) return { pendingCount: 0, items: [] };

  await localDb.reconcileGatekeeperKnownSenders({
    userId,
    mailboxId,
  });

  const [pendingCount, items] = await Promise.all([
    localDb.getGatekeeperPendingCount(userId, mailboxId),
    localDb.getGatekeeperPending({ userId, mailboxId, limit }),
  ]);

  return { pendingCount, items };
}

async function submitGatekeeperDecision(input: {
  mailboxId: number;
  fromAddr: string;
  decision: GatekeeperDecision;
}): Promise<GatekeeperDecisionResult> {
  const response = await fetch("/api/inbox/gatekeeper/decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | { data?: GatekeeperDecisionResult; error?: string }
    | null;

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.error ?? "Failed to apply gatekeeper decision");
  }

  return payload.data;
}

export function useGatekeeperPending(mailboxId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.gatekeeper.pending(mailboxId),
    queryFn: () => fetchGatekeeperPending(mailboxId),
    staleTime: 5_000,
    enabled,
  });
}

export function useGatekeeperDecision(mailboxId: number) {
  return useMutation({
    mutationFn: async (input: {
      fromAddr: string;
      decision: GatekeeperDecision;
    }) => {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      const result = await submitGatekeeperDecision({
        mailboxId,
        fromAddr: input.fromAddr,
        decision: input.decision,
      });

      await localDb.applyGatekeeperDecision({
        userId,
        mailboxId,
        fromAddr: input.fromAddr,
        decision: input.decision,
      });

      return result;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.gatekeeper.pending(mailboxId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() }),
      ]);
    },
  });
}
