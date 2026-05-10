import { accountQueryKeys } from "@/features/settings/query-keys";
import { queryOptions, useQuery } from "@tanstack/react-query";

export type MailboxSignature = {
  id: string;
  name: string;
  body: string;
};

export type MailboxSignatureState = {
  defaultId: string | null;
  items: MailboxSignature[];
};

export type MailboxTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

export type MailboxTemplateState = {
  items: MailboxTemplate[];
};

export type MailboxAccount = {
  accountId: string;
  mailboxId: number | null;
  email: string | null;
  signature: string | null;
  signatures: MailboxSignatureState;
  templates: MailboxTemplateState;
  gmailEmail?: string | null;
  authState: string;
  lastSync: number | null;
  hasSynced: boolean;
  hasValidCredentials: boolean;
  syncWindowMonths: 3 | 6 | 12 | null;
  syncCutoffAt: number | null;
  aiEnabled: boolean;
  aiClassificationEnabled: boolean;
  syncState: "needs_reconnect" | "ready_to_sync" | "error" | "ready";
  error: string | null;
  createdAt: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeSignatureState(
  state: MailboxSignatureState,
): MailboxSignatureState {
  const items = state.items
    .map((item) => ({
      id: item.id.trim(),
      name: item.name.trim(),
      body: item.body,
    }))
    .filter((item) => item.id.length > 0 && item.name.length > 0);
  const hasDefault = items.some((item) => item.id === state.defaultId);
  return {
    defaultId: hasDefault ? state.defaultId : (items[0]?.id ?? null),
    items,
  };
}

function parseSignatureItem(
  rawItem: unknown,
  index: number,
): MailboxSignature | null {
  if (!isRecord(rawItem)) return null;
  const item = rawItem;
  const bodyValue =
    typeof item.body === "string"
      ? item.body
      : typeof item.html === "string"
        ? item.html
        : typeof item.content === "string"
          ? item.content
          : null;
  if (bodyValue == null) return null;

  const trimmedId = typeof item.id === "string" ? item.id.trim() : "";
  const trimmedName = typeof item.name === "string" ? item.name.trim() : "";

  return {
    id: trimmedId || `sig_${index + 1}`,
    name: trimmedName || `Signature ${index + 1}`,
    body: bodyValue,
  };
}

function parseMailboxSignatures(
  raw: string | null | undefined,
): MailboxSignatureState {
  const value = raw?.trim();
  if (!value) {
    return { defaultId: null, items: [] };
  }

  try {
    const parsed = JSON.parse(value) as {
      defaultId?: unknown;
      items?: unknown;
    };
    const rawItems = Array.isArray(parsed.items)
      ? parsed.items
      : Array.isArray(parsed)
        ? parsed
        : null;
    if (rawItems) {
      return normalizeSignatureState({
        defaultId:
          typeof parsed.defaultId === "string" ? parsed.defaultId : null,
        items: rawItems
          .map((item, index) => parseSignatureItem(item, index))
          .filter((item): item is MailboxSignature => item != null),
      });
    }
  } catch {}

  return {
    defaultId: "default",
    items: [{ id: "default", name: "Default", body: value }],
  };
}

function normalizeTemplateState(
  state: MailboxTemplateState,
): MailboxTemplateState {
  const items = state.items
    .map((item) => ({
      id: item.id.trim(),
      name: item.name.trim(),
      subject: item.subject,
      body: item.body,
    }))
    .filter((item) => item.id.length > 0 && item.name.length > 0);
  return { items };
}

function parseMailboxTemplates(
  raw: string | null | undefined,
): MailboxTemplateState {
  const value = raw?.trim();
  if (!value) return { items: [] };

  try {
    const parsed = JSON.parse(value);
    if (!isRecord(parsed)) return { items: [] };
    if (Array.isArray(parsed.items)) {
      return normalizeTemplateState({
        items: parsed.items.filter(isRecord).flatMap((item) =>
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          typeof item.subject === "string" &&
          typeof item.body === "string"
            ? [
                {
                  id: item.id,
                  name: item.name,
                  subject: item.subject,
                  body: item.body,
                },
              ]
            : [],
        ),
      });
    }
  } catch {}

  return { items: [] };
}

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

type RawMailboxAccount = Omit<MailboxAccount, "signatures" | "templates"> & {
  templates: string | null;
};

function isRawMailboxAccount(value: unknown): value is RawMailboxAccount {
  if (!isRecord(value)) return false;
  return (
    typeof value.accountId === "string" &&
    (typeof value.mailboxId === "number" || value.mailboxId === null) &&
    (typeof value.email === "string" || value.email === null) &&
    (typeof value.signature === "string" || value.signature === null) &&
    (typeof value.templates === "string" || value.templates === null) &&
    typeof value.authState === "string" &&
    typeof value.hasSynced === "boolean" &&
    typeof value.hasValidCredentials === "boolean" &&
    typeof value.aiEnabled === "boolean" &&
    typeof value.aiClassificationEnabled === "boolean"
  );
}

export async function fetchAccounts(): Promise<{ accounts: MailboxAccount[] }> {
  const response = await fetch("/api/settings/accounts");
  if (!response.ok) {
    throw new Error("Failed to fetch accounts");
  }
  const json = await response.json();
  const data = isRecord(json) && isRecord(json.data) ? json.data : null;
  const accounts = Array.isArray(data?.accounts)
    ? data.accounts.filter(isRawMailboxAccount)
    : [];
  return {
    accounts: accounts.map((account) => ({
      ...account,
      signatures: parseMailboxSignatures(account.signature),
      templates: parseMailboxTemplates(account.templates),
    })),
  };
}

export const accountsQueryOptions = queryOptions({
  queryKey: accountQueryKeys.all(),
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
      typeof json === "object" &&
        json !== null &&
        "error" in json &&
        typeof json.error === "string"
        ? json.error
        : "Failed to remove account",
    );
  }
}
