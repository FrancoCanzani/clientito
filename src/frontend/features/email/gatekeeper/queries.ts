import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { gatekeeperQueryKeys } from "@/features/email/gatekeeper/query-keys";
import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import type { EmailListItem, EmailListPage } from "@/features/email/mail/types";
import { isEmailListInfiniteData } from "@/features/email/mail/utils/email-list-cache";
import { queryClient } from "@/lib/query-client";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";

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

function normalizeSenderAddress(value: string | null | undefined): string {
 return value?.trim().toLowerCase() ?? "";
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
 return useMutation<
 GatekeeperDecisionResult,
 Error,
 {
 fromAddr: string;
 decision: GatekeeperDecision;
 },
 {
 pendingSnapshot: GatekeeperPendingState | undefined;
 emailSnapshots: Array<[QueryKey, InfiniteData<EmailListPage> | undefined]>;
 }
 >({
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
 onMutate: async (input) => {
 await queryClient.cancelQueries({
 queryKey: gatekeeperQueryKeys.pending(mailboxId),
 });
 const pendingSnapshot = queryClient.getQueryData<GatekeeperPendingState>(
 gatekeeperQueryKeys.pending(mailboxId),
 );
 const emailSnapshots = queryClient.getQueriesData<InfiniteData<EmailListPage>>({
 queryKey: emailQueryKeys.all(),
 });
 const sender = normalizeSenderAddress(input.fromAddr);

 queryClient.setQueryData<GatekeeperPendingState | undefined>(
 gatekeeperQueryKeys.pending(mailboxId),
 (current) => {
 if (!current) return current;
 const beforeSenders = new Set(
 current.items.map((item) => normalizeSenderAddress(item.fromAddr)),
 );
 const items = current.items.filter(
 (item) => normalizeSenderAddress(item.fromAddr) !== sender,
 );
 const removedSender = beforeSenders.has(sender);
 return {
 ...current,
 items,
 pendingCount: removedSender
 ? Math.max(0, current.pendingCount - 1)
 : current.pendingCount,
 };
 },
 );

 for (const [queryKey, data] of emailSnapshots) {
 if (!isEmailListInfiniteData(data)) continue;
 queryClient.setQueryData(queryKey, {
 ...data,
 pages: data.pages.map((page) => ({
 ...page,
 emails:
 input.decision === "reject"
 ? page.emails.filter(
 (item) => normalizeSenderAddress(item.fromAddr) !== sender,
 )
 : page.emails.map((item) =>
 normalizeSenderAddress(item.fromAddr) === sender
 ? { ...item, isGatekept: false }
 : item,
 ),
 })),
 });
 }

 return { pendingSnapshot, emailSnapshots };
 },
 onError: (_error, _input, context) => {
 if (context?.pendingSnapshot) {
 queryClient.setQueryData(
 gatekeeperQueryKeys.pending(mailboxId),
 context.pendingSnapshot,
 );
 }
 for (const [queryKey, data] of context?.emailSnapshots ?? []) {
 queryClient.setQueryData(queryKey, data);
 }
 },
 onSuccess: async () => {
 await Promise.all([
 queryClient.invalidateQueries({ queryKey: gatekeeperQueryKeys.pending(mailboxId) }),
 queryClient.invalidateQueries({ queryKey: emailQueryKeys.all() }),
 ]);
 },
 });
}
