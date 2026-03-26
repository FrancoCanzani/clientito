import { queryOptions, useQuery } from "@tanstack/react-query";

const ACTIVE_SYNC_POLL_MS = 1_000;
const IDLE_SYNC_POLL_MS = 60_000;

export type MailboxAccount = {
  accountId: string;
  mailboxId: number | null;
  email: string | null;
  signature: string | null;
  gmailEmail?: string | null;
  authState: string;
  lastSync: number | null;
  hasSynced: boolean;
  hasValidCredentials: boolean;
  syncWindowMonths: 6 | 12 | null;
  syncCutoffAt: number | null;
  syncState: "needs_reconnect" | "ready_to_sync" | "error" | "syncing" | "ready";
  phase: string | null;
  progressCurrent: number | null;
  progressTotal: number | null;
  error: string | null;
  createdAt: number | null;
};

export function getMailboxDisplayEmail(
  account: Pick<MailboxAccount, "email" | "gmailEmail">,
): string | null {
  const candidates = [account.email, account.gmailEmail];

  for (const candidate of candidates) {
    const normalized = candidate?.trim();
    if (normalized && normalized.toLowerCase() !== "email") {
      return normalized;
    }
  }

  return null;
}

async function fetchAccounts(): Promise<{ accounts: MailboxAccount[] }> {
  const response = await fetch("/api/settings/accounts");
  if (!response.ok) {
    throw new Error("Failed to fetch accounts");
  }
  const json = await response.json();
  return json.data;
}

const accountsQueryOptions = queryOptions({
  queryKey: ["accounts"] as const,
  queryFn: fetchAccounts,
  staleTime: 30_000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchInterval: (query) => {
    const accounts = query.state.data?.accounts ?? [];
    return accounts.some((account) => account.syncState === "syncing")
      ? ACTIVE_SYNC_POLL_MS
      : IDLE_SYNC_POLL_MS;
  },
});

export function useMailboxes() {
  return useQuery(accountsQueryOptions);
}

export async function removeAccount(accountId: string): Promise<void> {
  const response = await fetch(`/api/settings/accounts/${accountId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(
      (json as { error?: string }).error ?? "Failed to remove account",
    );
  }
}
