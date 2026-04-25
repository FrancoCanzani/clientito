import { GMAIL_API_BASE, getGmailTokenForMailbox, gmailRequest } from "../client";
import type { Database } from "../../../db/client";

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
  isPrimary?: boolean;
  isDefault?: boolean;
};

type GmailSendAsListResponse = {
  sendAs?: GmailSendAs[];
};

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
      items?: Array<{ id?: unknown; name?: unknown; body?: unknown }>;
    };
    if (Array.isArray(parsed.items)) {
      return normalizeSignatureState({
        defaultId: typeof parsed.defaultId === "string" ? parsed.defaultId : null,
        items: parsed.items
          .filter(
            (item) =>
              typeof item?.id === "string" &&
              typeof item?.name === "string" &&
              typeof item?.body === "string",
          )
          .map((item) => ({
            id: item.id as string,
            name: item.name as string,
            body: item.body as string,
          })),
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

  const response = await fetch(
    `${GMAIL_API_BASE}/settings/sendAs/${encodeURIComponent(target.sendAsEmail)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signature: signatureBody,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Failed to sync Gmail signature (${response.status}): ${text || response.statusText}`,
    );
  }
}
