import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { subscriptionQueryKeys } from "./query-keys";

export type UnsubscribeResult = {
  method: string;
  fromAddr: string;
  success: boolean;
  url?: string;
  error?: string;
  archivedCount?: number;
};

export async function unsubscribe(input: {
  fromAddr: string;
  unsubscribeUrl?: string;
  unsubscribeEmail?: string;
}): Promise<UnsubscribeResult> {
  const response = await fetch("/api/inbox/subscriptions/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error =
      typeof payload === "object" && payload !== null
        ? Reflect.get(payload, "error")
        : undefined;
    throw new Error(
      typeof error === "string" ? error : "Failed to unsubscribe",
    );
  }

  return response.json();
}

type SubscriptionSender = {
  fromAddr: string;
  fromName: string | null;
  emailCount: number;
  latestDate: number;
  latestSubject: string | null;
  latestSnippet: string | null;
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
};

async function fetchSubscriptionSenders(
  mailboxId: number,
): Promise<SubscriptionSender[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  return localDb.getSubscriptionSenders({ userId, mailboxId });
}

export function useSubscriptionSenders(mailboxId: number, enabled = true) {
  return useQuery({
    queryKey: subscriptionQueryKeys.senders(mailboxId),
    queryFn: () => fetchSubscriptionSenders(mailboxId),
    staleTime: 60_000,
    enabled,
  });
}

async function refreshAfterMutation(_mailboxId: number) {}

export function useUnsubscribe(mailboxId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unsubscribe,
    onSuccess: async (data, input) => {
      const userId = await getCurrentUserId();
      if (userId) {
        await localDb.clearUnsubscribeForSender({
          userId,
          mailboxId,
          fromAddr: input.fromAddr,
        });
      }
      if (data.success) {
        toast.success(`Unsubscribed from ${data.fromAddr}`);
      } else if (data.method === "manual" && data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        toast.info("Opened unsubscribe page — complete it in your browser");
      }
      await refreshAfterMutation(mailboxId);
      await queryClient.invalidateQueries({
        queryKey: subscriptionQueryKeys.senders(mailboxId),
      });
      await queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
    onError: () => toast.error("Unsubscribe failed"),
  });
}

export function useBlockSender(mailboxId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { fromAddr: string; mailboxId: number }) => {
      const response = await fetch("/api/inbox/subscriptions/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const error =
          typeof payload === "object" && payload !== null
            ? Reflect.get(payload, "error")
            : undefined;
        throw new Error(
          typeof error === "string" ? error : "Failed to block sender",
        );
      }
      return response.json() as Promise<{
        data: { fromAddr: string; trashedCount: number };
      }>;
    },
    onSuccess: async (result, input) => {
      const userId = await getCurrentUserId();
      if (userId) {
        await localDb.clearUnsubscribeForSender({
          userId,
          mailboxId,
          fromAddr: input.fromAddr,
        });
        await localDb.trashEmailsFromSender({
          userId,
          mailboxId,
          fromAddr: input.fromAddr,
        });
      }
      const { trashedCount } = result.data;
      toast.success(
        trashedCount > 0
          ? `Blocked and moved ${trashedCount} ${trashedCount === 1 ? "email" : "emails"} to trash`
          : "Blocked sender",
      );
      await refreshAfterMutation(mailboxId);
      await queryClient.invalidateQueries({
        queryKey: subscriptionQueryKeys.senders(mailboxId),
      });
      await queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
    onError: () => toast.error("Failed to block sender"),
  });
}
