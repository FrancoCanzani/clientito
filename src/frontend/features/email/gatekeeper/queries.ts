import { emailQueryKeys } from "@/features/email/inbox/query-keys";
import { gatekeeperQueryKeys } from "@/features/email/gatekeeper/query-keys";
import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import type { EmailListItem } from "@/features/email/inbox/types";
import { queryClient } from "@/lib/query-client";
import { useMutation, useQuery } from "@tanstack/react-query";

type GatekeeperPendingState = {
  pendingCount: number;
  items: EmailListItem[];
};

type GatekeeperDecision = "accept" | "reject";

type GatekeeperDecisionResult = {
  fromAddr: string;
  trustLevel: "trusted" | "blocked";
  decision: GatekeeperDecision;
  providerBlocked: boolean;
  trashedCount: number;
  providerError: string | null;
  requiresReconnect: boolean;
};

function gatekeeperActivatedAtKey(mailboxId: number): string {
  return `gatekeeperActivatedAt:${mailboxId}`;
}

async function resolveGatekeeperActivatedAt(mailboxId: number): Promise<number> {
  const key = gatekeeperActivatedAtKey(mailboxId);
  const raw = await localDb.getMeta(key);
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;

  const now = Date.now();
  await localDb.setMeta(key, String(now));
  return now;
}

async function fetchGatekeeperPending(
  mailboxId: number,
  limit = 30,
): Promise<GatekeeperPendingState> {
  const userId = await getCurrentUserId();
  if (!userId) return { pendingCount: 0, items: [] };
  const gatekeeperActivatedAt = await resolveGatekeeperActivatedAt(mailboxId);

  await localDb.reconcileGatekeeperKnownSenders({
    userId,
    mailboxId,
    gatekeeperActivatedAt,
  });

  const gatekeptSenders = await localDb.getGatekeptSenders(userId, mailboxId);
  if (gatekeptSenders.length > 0) {
    try {
      const response = await fetch("/api/inbox/gatekeeper/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mailboxId, senders: gatekeptSenders }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            data?: {
              trust?: Array<{
                sender: string;
                trustLevel: "trusted" | "blocked" | null;
              }>;
            };
          }
        | null;
      const trusted = (payload?.data?.trust ?? [])
        .filter((entry) => entry.trustLevel === "trusted")
        .map((entry) => entry.sender);
      if (trusted.length > 0) {
        await localDb.clearGatekeptForSenders({ userId, mailboxId, senders: trusted });
      }
    } catch {
      // ignore; local pile remains until next attempt
    }
  }

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
    queryKey: gatekeeperQueryKeys.pending(mailboxId),
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
        queryClient.invalidateQueries({ queryKey: gatekeeperQueryKeys.pending(mailboxId) }),
        queryClient.invalidateQueries({ queryKey: emailQueryKeys.all() }),
      ]);
    },
  });
}
