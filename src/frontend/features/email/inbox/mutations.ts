import { localDb } from "@/db/client";
import { isSynced } from "@/db/sync";
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

async function syncLocalPatch(emailIds: string[], patch: EmailPatchPayload) {
  if (typeof window === "undefined") {
    return;
  }

  const userId = await getCurrentUserId();
  if (!userId || !(await isSynced(userId))) {
    return;
  }

  const numericIds = emailIds
    .map((id) => Number(id))
    .filter((value) => Number.isFinite(value));

  if (numericIds.length === 0) {
    return;
  }

  try {
    if (numericIds.length === 1) {
      await localDb.updateEmail(userId, numericIds[0]!, patch);
    } else {
      await localDb.updateEmails(userId, numericIds, patch);
    }
  } catch (error) {
    console.warn("Failed to sync local email patch", error);
  }
}

export async function patchEmail(
  emailId: string,
  data: EmailPatchPayload,
): Promise<void> {
  const response = await fetch(`/api/inbox/emails/${emailId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throwApiError(json, "Failed to update email");
  }

  void syncLocalPatch([emailId], data);
}

export async function batchPatchEmails(
  emailIds: string[],
  data: EmailPatchPayload,
): Promise<void> {
  const response = await fetch("/api/inbox/emails/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      emailIds: emailIds.map((id) => Number(id)),
      ...data,
    }),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throwApiError(json, "Failed to update emails");
  }

  void syncLocalPatch(emailIds, data);
}

export async function markEmailRead(emailId: string): Promise<void> {
  await patchEmail(emailId, { isRead: true });
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
