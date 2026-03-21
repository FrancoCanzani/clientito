import { queryOptions, useQuery } from "@tanstack/react-query";

export type MailboxAccount = {
  accountId: string;
  mailboxId: number | null;
  gmailEmail: string | null;
  authState: string;
  lastSync: number | null;
  hasSynced: boolean;
  hasValidCredentials: boolean;
};

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
  staleTime: 60_000,
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
