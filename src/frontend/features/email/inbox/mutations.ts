import { localDb } from "@/db/client";
import { clearPending, markPending } from "@/db/pending-lock";
import { getCurrentUserId } from "@/db/user";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  EmailDetailItem,
  EmailListItem,
  EmailListResponse,
} from "./types";
import type { InfiniteData } from "@tanstack/react-query";

function getErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const error = Reflect.get(payload, "error");
  return typeof error === "string" ? error : null;
}

function throwApiError(payload: unknown, fallback: string): never {
  throw new Error(getErrorMessage(payload) ?? fallback);
}

async function responseError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const json = await response.json().catch(() => null);
  const err = new Error(getErrorMessage(json) ?? fallback);
  (err as Error & { status?: number }).status = response.status;
  return err;
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

const LABEL_UNREAD = "UNREAD";
const LABEL_INBOX = "INBOX";
const LABEL_TRASH = "TRASH";
const LABEL_SPAM = "SPAM";
const LABEL_STARRED = "STARRED";

function toNumericIds(ids: string[]): number[] {
  return ids
    .map((id) => Number(id))
    .filter((value) => Number.isFinite(value));
}

function applyPatchToItem<
  T extends Pick<EmailListItem, "isRead" | "labelIds" | "snoozedUntil">,
>(item: T, patch: EmailPatchPayload): T {
  const labels = new Set(item.labelIds);

  if (patch.isRead !== undefined) {
    if (patch.isRead) labels.delete(LABEL_UNREAD);
    else labels.add(LABEL_UNREAD);
  }

  if (patch.archived !== undefined) {
    if (patch.archived) labels.delete(LABEL_INBOX);
    else if (!labels.has(LABEL_TRASH) && !labels.has(LABEL_SPAM)) labels.add(LABEL_INBOX);
  }

  if (patch.trashed !== undefined) {
    if (patch.trashed) {
      labels.add(LABEL_TRASH);
      labels.delete(LABEL_INBOX);
      labels.delete(LABEL_SPAM);
    } else {
      labels.delete(LABEL_TRASH);
      if (!labels.has(LABEL_SPAM)) labels.add(LABEL_INBOX);
    }
  }

  if (patch.spam !== undefined) {
    if (patch.spam) {
      labels.add(LABEL_SPAM);
      labels.delete(LABEL_INBOX);
      labels.delete(LABEL_TRASH);
    } else {
      labels.delete(LABEL_SPAM);
      if (!labels.has(LABEL_TRASH)) labels.add(LABEL_INBOX);
    }
  }

  if (patch.starred !== undefined) {
    if (patch.starred) labels.add(LABEL_STARRED);
    else labels.delete(LABEL_STARRED);
  }

  return {
    ...item,
    isRead: patch.isRead ?? !labels.has(LABEL_UNREAD),
    labelIds: Array.from(labels),
    snoozedUntil:
      patch.snoozedUntil !== undefined ? patch.snoozedUntil : item.snoozedUntil,
  };
}

function applyOptimisticCachePatch(
  emailIds: Set<string>,
  patch: EmailPatchPayload,
) {
  queryClient.setQueriesData<InfiniteData<EmailListResponse>>(
    { queryKey: queryKeys.emails.all() },
    (current) => {
      if (!current) return current;
      let changed = false;
      const pages = current.pages.map((page) => {
        let pageChanged = false;
        const data = page.data.map((entry) => {
          if (!emailIds.has(entry.id)) return entry;
          const next = applyPatchToItem(entry, patch);
          pageChanged = true;
          changed = true;
          return next;
        });
        return pageChanged ? { ...page, data } : page;
      });
      return changed ? { ...current, pages } : current;
    },
  );

  for (const emailId of emailIds) {
    queryClient.setQueryData<EmailDetailItem | undefined>(
      queryKeys.emails.detail(emailId),
      (current) => {
        if (!current) return current;
        return applyPatchToItem(current, patch);
      },
    );
  }
}

async function applyLocalPatch(
  userId: string,
  emailIds: string[],
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
  void queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });
  for (const emailId of emailIds) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.emails.detail(emailId),
    });
  }
}

export async function patchEmails(
  emails: EmailIdentifier[],
  data: EmailPatchPayload,
): Promise<void> {
  if (emails.length === 0) return;
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");

  const mailboxId = emails[0]!.mailboxId;
  const providerIds = emails.map((e) => e.providerMessageId);
  const emailIds = emails.map((e) => e.id);
  const emailIdSet = new Set(emailIds);
  applyOptimisticCachePatch(emailIdSet, data);
  const localPatchTask = applyLocalPatch(
    userId,
    emailIds,
    toNumericIds(emailIds),
    data,
  );
  markPending(providerIds);

  try {
    if (emails.length === 1) {
      const email = emails[0]!;
      const response = await fetch(`/api/inbox/emails/${email.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerMessageId: email.providerMessageId,
          mailboxId: email.mailboxId,
          labelIds: email.labelIds ?? [],
          ...data,
        }),
      });
      if (!response.ok) throw await responseError(response, "Failed to update email");
      return;
    }

    // Group by labelIds snapshot so the server computes the correct
    // add/remove set for each message. Most bulk actions share a view so
    // this usually collapses to one request.
    const groups = new Map<string, EmailIdentifier[]>();
    for (const email of emails) {
      const key = JSON.stringify(email.labelIds ?? []);
      const bucket = groups.get(key);
      if (bucket) bucket.push(email);
      else groups.set(key, [email]);
    }

    for (const [key, bucket] of groups) {
      const items = bucket.map((e) => ({
        providerMessageId: e.providerMessageId,
        mailboxId,
        labelIds: JSON.parse(key) as string[],
      }));
      const response = await fetch("/api/inbox/emails/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, ...data }),
      });
      if (!response.ok) throw await responseError(response, "Failed to update emails");
    }
    await localPatchTask;
  } finally {
    await localPatchTask;
    clearPending(providerIds);
  }
}

export function patchEmail(
  email: EmailIdentifier,
  data: EmailPatchPayload,
): Promise<void> {
  return patchEmails([email], data);
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

  markPending([email.providerMessageId]);
  try {
    const response = await fetch(`/api/inbox/emails/${email.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerMessageId: email.providerMessageId,
        mailboxId: email.mailboxId,
      }),
    });
    if (!response.ok) throw await responseError(response, "Failed to delete email");
  } finally {
    clearPending([email.providerMessageId]);
  }
}

export function batchPatchEmails(
  emails: EmailIdentifier[],
  data: EmailPatchPayload,
): Promise<void> {
  return patchEmails(emails, data);
}

export function markEmailRead(email: EmailIdentifier): Promise<void> {
  return patchEmail(email, { isRead: true });
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

  return response.json();
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
  return response.json();
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
  for (const file of files) formData.append("file", file);

  const response = await fetch("/api/inbox/emails/attachments", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throwApiError(json, "Failed to upload attachments");
  }

  return response.json();
}
