import { queryKeys } from "@/lib/query-keys";
import { queryOptions, useQuery } from "@tanstack/react-query";

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
  syncState: "needs_reconnect" | "ready_to_sync" | "error" | "ready";
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

export async function fetchAccounts(): Promise<{ accounts: MailboxAccount[] }> {
  const response = await fetch("/api/settings/accounts");
  if (!response.ok) {
    throw new Error("Failed to fetch accounts");
  }
  const json = await response.json();
  return json.data;
}

export const accountsQueryOptions = queryOptions({
  queryKey: queryKeys.accounts(),
  queryFn: fetchAccounts,
  staleTime: 60_000,
  refetchOnReconnect: true,
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
      (typeof json === "object" &&
      json !== null &&
      "error" in json &&
      typeof json.error === "string"
        ? json.error
        : "Failed to remove account"),
    );
  }
}
