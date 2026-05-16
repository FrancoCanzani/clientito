import { and, eq } from "drizzle-orm";
import { getGmailTokenForMailbox, gmailMutation, gmailRequest } from "../client";
import type { Database } from "../../../db/client";
import { mailboxes } from "../../../db/schema";

const SIGNATURE_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

type MailboxSignatureItem = {
  id: string;
  name: string;
  body: string;
};

type MailboxSignatureState = {
  defaultId: string | null;
  items: MailboxSignatureItem[];
};

type GmailSendAs = {
  sendAsEmail: string;
  displayName?: string;
  isPrimary?: boolean;
  isDefault?: boolean;
  signature?: string;
};

type GmailSendAsListResponse = {
  sendAs?: GmailSendAs[];
};

function slugifyEmail(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "sig";
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
): MailboxSignatureItem | null {
  if (!rawItem || typeof rawItem !== "object") return null;
  const item = rawItem as Record<string, unknown>;
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

function parseSignatureState(
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
        defaultId: typeof parsed.defaultId === "string" ? parsed.defaultId : null,
        items: rawItems
          .map((item, index) => parseSignatureItem(item, index))
          .filter((item): item is MailboxSignatureItem => item != null),
      });
    }
  } catch {}

  return {
    defaultId: "default",
    items: [{ id: "default", name: "Default", body: value }],
  };
}

function getSignatureBody(
  raw: string | null | undefined,
  signatureId?: string | null,
): string | null {
  const state = parseSignatureState(raw);
  const picked = signatureId
    ? state.items.find((item) => item.id === signatureId)
    : undefined;
  const item =
    picked ??
    (state.defaultId
      ? state.items.find((entry) => entry.id === state.defaultId)
      : undefined) ??
    null;
  const body = item?.body?.trim();
  return body ? body : null;
}

export function appendSignature(
  body: string,
  signature: string | null | undefined,
): string {
  if (body.includes("data-petit-signature-id")) return body;
  const signatureBody = getSignatureBody(signature);
  if (!signatureBody) return body;
  return `${body}<div data-petit-signature-id="default" style="margin-top:16px;border-top:1px solid #dadce0;padding-top:12px;color:#5f6368;font-size:13px;white-space:pre-wrap">${signatureBody}</div>`;
}

export async function pullSignaturesFromGmail(
  db: Database,
  env: { GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string },
  mailboxId: number,
): Promise<MailboxSignatureState> {
  const accessToken = await getGmailTokenForMailbox(db, mailboxId, env);

  const sendAs = await gmailRequest<GmailSendAsListResponse>(
    accessToken,
    "/settings/sendAs",
    {
      fields:
        "sendAs(sendAsEmail,displayName,isPrimary,isDefault,signature)",
    },
  );

  const entries = sendAs.sendAs ?? [];
  const items: MailboxSignatureItem[] = [];
  const seenIds = new Set<string>();
  let defaultId: string | null = null;

  for (const entry of entries) {
    const body = entry.signature?.trim();
    if (!body) continue;
    const email = entry.sendAsEmail?.trim();
    if (!email) continue;

    let id = slugifyEmail(email);
    let suffix = 2;
    while (seenIds.has(id)) {
      id = `${slugifyEmail(email)}_${suffix++}`;
    }
    seenIds.add(id);

    const name = entry.displayName?.trim() || email;
    items.push({ id, name, body });

    if (entry.isDefault && !defaultId) defaultId = id;
  }

  if (!defaultId && items.length > 0) defaultId = items[0].id;

  return normalizeSignatureState({ defaultId, items });
}

export async function refreshMailboxSignaturesIfStale(
  db: Database,
  env: { GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string },
  mailbox: {
    id: number;
    userId: string;
    signaturesSyncedAt: number | null;
  },
  options?: { force?: boolean },
): Promise<void> {
  if (
    !options?.force &&
    mailbox.signaturesSyncedAt != null &&
    Date.now() - mailbox.signaturesSyncedAt < SIGNATURE_REFRESH_INTERVAL_MS
  ) {
    return;
  }

  try {
    const state = await pullSignaturesFromGmail(db, env, mailbox.id);
    const now = Date.now();
    const update: Record<string, unknown> = {
      signaturesSyncedAt: now,
      updatedAt: now,
    };
    if (state.items.length > 0) {
      update.signature = JSON.stringify(state);
    }
    await db
      .update(mailboxes)
      .set(update)
      .where(
        and(eq(mailboxes.id, mailbox.id), eq(mailboxes.userId, mailbox.userId)),
      );
  } catch (error) {
    console.warn("Failed to refresh Gmail signatures", {
      mailboxId: mailbox.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function syncMailboxSignatureToGmail(
  db: Database,
  env: { GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string },
  mailboxId: number,
  mailboxEmail: string | null | undefined,
  signature: string | null | undefined,
): Promise<void> {
  const accessToken = await getGmailTokenForMailbox(db, mailboxId, env);
  const signatureBody = getSignatureBody(signature) ?? "";

  const sendAs = await gmailRequest<GmailSendAsListResponse>(
    accessToken,
    "/settings/sendAs",
    {
      fields: "sendAs(sendAsEmail,isPrimary,isDefault)",
    },
  );

  const entries = sendAs.sendAs ?? [];
  if (entries.length === 0) return;

  const normalizedMailboxEmail = mailboxEmail?.trim().toLowerCase() ?? null;
  const target =
    (normalizedMailboxEmail
      ? entries.find(
          (entry) =>
            entry.sendAsEmail?.trim().toLowerCase() === normalizedMailboxEmail,
        )
      : undefined) ??
    entries.find((entry) => entry.isPrimary) ??
    entries[0];

  if (!target?.sendAsEmail) return;

  await gmailMutation(
    accessToken,
    "PATCH",
    `/settings/sendAs/${encodeURIComponent(target.sendAsEmail)}`,
    { signature: signatureBody },
  );
}
