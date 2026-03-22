import { env } from "cloudflare:workers";
import { TEST_USER } from "./setup";

let emailCounter = 0;

export async function seedEmail(
  overrides: Partial<{
    userId: string;
    mailboxId: number | null;
    providerMessageId: string;
    threadId: string;
    fromAddr: string;
    fromName: string;
    toAddr: string;
    subject: string;
    snippet: string;
    bodyText: string;
    bodyHtml: string;
    date: number;
    direction: "sent" | "received";
    isRead: boolean;
    labelIds: string[];
    snoozedUntil: number | null;
  }> = {},
): Promise<number> {
  emailCounter++;
  const now = Date.now();
  const defaults = {
    userId: TEST_USER.id,
    mailboxId: null,
    providerMessageId: `gmail-${emailCounter}-${now}`,
    threadId: `thread-${emailCounter}`,
    fromAddr: "sender@example.com",
    fromName: "Sender",
    toAddr: "test@example.com",
    subject: `Test email ${emailCounter}`,
    snippet: "This is a test email",
    bodyText: "Test body",
    bodyHtml: "<p>Test body</p>",
    date: now - emailCounter * 1000,
    direction: "received" as const,
    isRead: false,
    labelIds: ["INBOX"],
    snoozedUntil: null,
  };

  const data = { ...defaults, ...overrides };

  const result = await env.DB.prepare(
    `INSERT INTO emails (
      user_id, mailbox_id, provider_message_id, thread_id, from_addr, from_name,
      to_addr, subject, snippet, body_text, body_html, date, direction,
      is_read, label_ids, snoozed_until, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      data.userId,
      data.mailboxId,
      data.providerMessageId,
      data.threadId,
      data.fromAddr,
      data.fromName,
      data.toAddr,
      data.subject,
      data.snippet,
      data.bodyText,
      data.bodyHtml,
      data.date,
      data.direction,
      data.isRead ? 1 : 0,
      JSON.stringify(data.labelIds),
      data.snoozedUntil,
      now,
    )
    .run();

  return result.meta.last_row_id as number;
}

export async function seedMailbox(
  overrides: Partial<{
    userId: string;
    accountId: string;
    email: string;
  }> = {},
): Promise<number> {
  const now = Date.now();
  const result = await env.DB.prepare(
    `INSERT INTO mailboxes (user_id, account_id, email, updated_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(
      overrides.userId ?? TEST_USER.id,
      overrides.accountId ?? null,
      overrides.email ?? "test@gmail.com",
      now,
    )
    .run();

  return result.meta.last_row_id as number;
}

export async function seedAccount(
  overrides: Partial<{
    id: string;
    accountId: string;
    userId: string;
    providerId: string;
  }> = {},
): Promise<string> {
  const id = overrides.id ?? `acct-pk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      overrides.accountId ?? `google-${id}`,
      overrides.providerId ?? "google",
      overrides.userId ?? TEST_USER.id,
      now,
      now,
    )
    .run();
  return id;
}

export function resetEmailCounter() {
  emailCounter = 0;
}
