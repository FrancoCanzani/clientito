import { localDb } from "@/db/client";
import { enqueueMutation } from "@/db/mutation-queue";
import type { PendingMutationPayload, PendingMutationRow } from "@/db/schema";
import { getCurrentUserId } from "@/db/user";

function getErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const error = Reflect.get(payload, "error");
  return typeof error === "string" ? error : null;
}

function throwApiError(payload: unknown, fallback: string): never {
  throw new Error(getErrorMessage(payload) ?? fallback);
}

type EmailPatchPayload = {
  isRead?: boolean;
  archived?: boolean;
  trashed?: boolean;
  spam?: boolean;
  starred?: boolean;
  snoozedUntil?: number | null;
};

export type EmailIdentifier = {
  id: string;
  providerMessageId: string;
  mailboxId: number;
  labelIds?: string[];
};

function makeMutationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `mut_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function toNumericIds(ids: string[]): number[] {
  return ids
    .map((id) => Number(id))
    .filter((value) => Number.isFinite(value));
}

async function applyLocalPatch(
  userId: string,
  numericIds: number[],
  patch: EmailPatchPayload,
) {
  if (numericIds.length === 0) return;
  try {
    if (numericIds.length === 1) {
      await localDb.updateEmail(userId, numericIds[0]!, patch);
    } else {
      await localDb.updateEmails(userId, numericIds, patch);
    }
  } catch (error) {
    console.warn("Failed to apply local email patch", error);
  }
}

async function enqueuePatch(
  emails: EmailIdentifier[],
  data: EmailPatchPayload,
): Promise<void> {
  if (emails.length === 0) return;
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");

  const mailboxId = emails[0]!.mailboxId;
  const numericIds = toNumericIds(emails.map((e) => e.id));
  await applyLocalPatch(userId, numericIds, data);

  // Group by snapshot of labelIds so the server computes the correct
  // add/remove set for each message. Most bulk actions come from a single
  // view so this usually collapses to one enqueue.
  const groups = new Map<string, EmailIdentifier[]>();
  for (const email of emails) {
    const key = JSON.stringify(email.labelIds ?? []);
    const bucket = groups.get(key);
    if (bucket) bucket.push(email);
    else groups.set(key, [email]);
  }

  const now = Date.now();
  for (const [key, bucket] of groups) {
    const payload: PendingMutationPayload = {
      ...data,
      labelIds: JSON.parse(key) as string[],
    };
    const row: PendingMutationRow = {
      id: makeMutationId(),
      userId,
      mailboxId,
      kind: "patch",
      providerMessageIds: bucket.map((e) => e.providerMessageId),
      emailIds: toNumericIds(bucket.map((e) => e.id)),
      payload,
      status: "pending",
      attempts: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };
    await enqueueMutation(row);
  }
}

export async function patchEmail(
  email: EmailIdentifier,
  data: EmailPatchPayload,
): Promise<void> {
  await enqueuePatch([email], data);
}

export async function deleteEmailForever(
  email: EmailIdentifier,
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");

  try {
    await localDb.deleteEmailsByProviderMessageId([email.providerMessageId]);
  } catch (error) {
    console.warn("Failed to remove email locally", error);
  }

  const now = Date.now();
  const row: PendingMutationRow = {
    id: makeMutationId(),
    userId,
    mailboxId: email.mailboxId,
    kind: "delete",
    providerMessageIds: [email.providerMessageId],
    emailIds: toNumericIds([email.id]),
    payload: {},
    status: "pending",
    attempts: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
  await enqueueMutation(row);
}

export type BlockSenderResult = {
  fromAddr: string;
  trashedCount: number;
};

export async function blockSender(params: {
  fromAddr: string;
  mailboxId?: number;
}): Promise<BlockSenderResult> {
  const response = await fetch("/api/inbox/subscriptions/block", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const json = (await response.json().catch(() => null)) as
    | { data?: BlockSenderResult; error?: string; requiresReconnect?: boolean }
    | null;

  if (!response.ok || !json?.data) {
    if (response.status === 403 && json?.requiresReconnect) {
      throw new Error(
        "Reconnect Gmail to grant the filter-management permission, then try again.",
      );
    }
    throw new Error(json?.error ?? "Failed to block sender");
  }

  return json.data;
}

export async function batchPatchEmails(
  emails: EmailIdentifier[],
  data: EmailPatchPayload,
): Promise<void> {
  await enqueuePatch(emails, data);
}

export async function markEmailRead(email: EmailIdentifier): Promise<void> {
  await patchEmail(email, { isRead: true });
}

type SendEmailInput = {
  mailboxId?: number;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
  attachments?: Array<{ key: string; filename: string; mimeType: string }>;
  scheduledFor?: number;
};

type SendEmailResult = {
  providerMessageId?: string;
  threadId?: string;
  scheduledId?: number;
  scheduledFor?: number;
};

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const response = await fetch("/api/inbox/emails/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throwApiError(json, "Failed to send email");
  }

  const json: SendEmailResult = await response.json();
  return json;
}

export type ScheduledEmail = {
  id: number;
  to: string;
  subject: string;
  scheduledFor: number;
  status: "pending" | "sent" | "failed" | "cancelled";
  error: string | null;
  createdAt: number;
};

export async function fetchScheduledEmails(): Promise<ScheduledEmail[]> {
  const response = await fetch("/api/inbox/emails/scheduled");
  if (!response.ok) throw new Error("Failed to fetch scheduled emails");
  const json: ScheduledEmail[] = await response.json();
  return json;
}

export async function cancelScheduledEmail(id: number): Promise<void> {
  const response = await fetch(`/api/inbox/emails/scheduled/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throwApiError(json, "Failed to cancel scheduled email");
  }
}

export async function uploadAttachments(
  files: File[],
): Promise<
  Array<{ key: string; filename: string; mimeType: string; size: number }>
> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("file", file);
  }

  const response = await fetch("/api/inbox/emails/attachments", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throwApiError(json, "Failed to upload attachments");
  }

  const json: Array<{
    key: string;
    filename: string;
    mimeType: string;
    size: number;
  }> = await response.json();
  return json;
}
