import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { localDb } from "@/db/client";
import {
  clearPending,
  markPending,
} from "@/db/pending-lock";
import { getCurrentUserId } from "@/db/user";
import { queryClient } from "@/lib/query-client";
import { isEmailListInfiniteData } from "./utils/email-list-cache";
import type {
  CalendarInviteResponseStatus,
  EmailDetailItem,
  EmailListItem,
  EmailListPage,
  EmailThreadItem,
  InboxUnreadCount,
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

export type ThreadIdentifier = {
  threadId: string;
  mailboxId: number;
  labelIds?: string[];
};

const LABEL_UNREAD = "UNREAD";
const LABEL_INBOX = "INBOX";
const LABEL_TRASH = "TRASH";
const LABEL_SPAM = "SPAM";
const LABEL_STARRED = "STARRED";

type InboxUnreadDelta = {
  messagesUnread: number;
  threadsUnread: number;
};

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

function applyPatchToLabelIds(
  labelIds: string[],
  patch: EmailPatchPayload,
): string[] {
  return applyPatchToItem(
    { isRead: !labelIds.includes(LABEL_UNREAD), labelIds, snoozedUntil: null },
    patch,
  ).labelIds;
}

function isUnreadInboxLabelSet(labelIds: string[]): boolean {
  const labels = new Set(labelIds);
  return labels.has(LABEL_INBOX) && labels.has(LABEL_UNREAD);
}

function computeEmailUnreadDelta(
  labelIds: string[] | undefined,
  patch: EmailPatchPayload,
): number {
  const before = labelIds ?? [];
  const after = applyPatchToLabelIds(before, patch);
  return Number(isUnreadInboxLabelSet(after)) - Number(isUnreadInboxLabelSet(before));
}

function computeUnreadDeltaForEmails(
  emails: Array<Pick<EmailListItem, "labelIds">>,
  patch: EmailPatchPayload,
): InboxUnreadDelta {
  let messagesUnread = 0;
  for (const email of emails) {
    messagesUnread += computeEmailUnreadDelta(email.labelIds, patch);
  }
  return {
    messagesUnread,
    threadsUnread: messagesUnread,
  };
}

function computeUnreadDeltaForThread(
  emails: Array<Pick<EmailListItem, "labelIds">>,
  fallbackLabelIds: string[] | undefined,
  patch: EmailPatchPayload,
): InboxUnreadDelta {
  const source =
    emails.length > 0
      ? emails
      : [{ labelIds: fallbackLabelIds ?? [] }];
  const beforeThreadUnread = source.some((email) =>
    isUnreadInboxLabelSet(email.labelIds),
  );
  const afterThreadUnread = source.some((email) =>
    isUnreadInboxLabelSet(applyPatchToLabelIds(email.labelIds, patch)),
  );
  let messagesUnread = 0;
  for (const email of source) {
    messagesUnread += computeEmailUnreadDelta(email.labelIds, patch);
  }

  return {
    messagesUnread,
    threadsUnread: Number(afterThreadUnread) - Number(beforeThreadUnread),
  };
}

function applyInboxUnreadDelta(
  mailboxId: number,
  delta: InboxUnreadDelta,
) {
  if (delta.messagesUnread === 0 && delta.threadsUnread === 0) return;

  queryClient.setQueryData<InboxUnreadCount | undefined>(
    emailQueryKeys.inboxUnreadCount(mailboxId),
    (current) => {
      if (!current) return current;
      return {
        ...current,
        messagesUnread: Math.max(
          0,
          current.messagesUnread + delta.messagesUnread,
        ),
        threadsUnread: Math.max(
          0,
          current.threadsUnread + delta.threadsUnread,
        ),
      };
    },
  );
}

function restoreInboxUnreadCount(
  mailboxId: number,
  snapshot: InboxUnreadCount | undefined,
) {
  if (!snapshot) return;
  queryClient.setQueryData(emailQueryKeys.inboxUnreadCount(mailboxId), snapshot);
}

function invalidateInboxUnreadCount(mailboxId: number) {
  void queryClient.invalidateQueries({
    queryKey: emailQueryKeys.inboxUnreadCount(mailboxId),
  });
}

function applyOptimisticCachePatch(
  emailIds: Set<string>,
  patch: EmailPatchPayload,
) {
  queryClient.setQueriesData(
    { queryKey: emailQueryKeys.all() },
    (current) => {
      if (!isEmailListInfiniteData(current)) return current;
      let changed = false;
      const pages = current.pages.map((page) => {
        let pageChanged = false;
        const emails = page.emails.map((entry) => {
          if (!emailIds.has(entry.id)) return entry;
          const next = applyPatchToItem(entry, patch);
          pageChanged = true;
          changed = true;
          return next;
        });
        return pageChanged ? { ...page, emails } : page;
      });
      const next: InfiniteData<EmailListPage> = { ...current, pages };
      return changed ? next : current;
    },
  );

  for (const emailId of emailIds) {
    queryClient.setQueryData<EmailDetailItem | undefined>(
      emailQueryKeys.detail(emailId),
      (current) => {
        if (!current) return current;
        return applyPatchToItem(current, patch);
      },
    );
  }
}

function applyOptimisticThreadPatch(
  threadId: string,
  patch: EmailPatchPayload,
) {
  queryClient.setQueriesData(
    { queryKey: emailQueryKeys.all() },
    (current) => {
      if (!isEmailListInfiniteData(current)) return current;
      let changed = false;
      const pages = current.pages.map((page) => {
        let pageChanged = false;
        const emails = page.emails.map((entry) => {
          if (entry.threadId !== threadId) return entry;
          const next = applyPatchToItem(entry, patch);
          pageChanged = true;
          changed = true;
          return next;
        });
        return pageChanged ? { ...page, emails } : page;
      });
      const next: InfiniteData<EmailListPage> = { ...current, pages };
      return changed ? next : current;
    },
  );

  queryClient.setQueryData<EmailThreadItem[] | undefined>(
    emailQueryKeys.thread(threadId),
    (current) => current?.map((entry) => applyPatchToItem(entry, patch)),
  );

  const detailSnapshots = queryClient.getQueriesData<EmailDetailItem>({
    queryKey: ["email-detail"],
  });
  for (const [queryKey, detail] of detailSnapshots) {
    if (detail?.threadId !== threadId) continue;
    queryClient.setQueryData(queryKey, applyPatchToItem(detail, patch));
  }
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

async function rollbackLocalPatch(
  userId: string,
  snapshots: EmailListItem[],
): Promise<void> {
  for (const snapshot of snapshots) {
    const numericId = Number(snapshot.id);
    if (!Number.isFinite(numericId)) continue;
    const labels = new Set(snapshot.labelIds);
    try {
      await localDb.updateEmail(userId, numericId, {
        isRead: snapshot.isRead,
        archived: !labels.has(LABEL_INBOX),
        trashed: labels.has(LABEL_TRASH),
        spam: labels.has(LABEL_SPAM),
        starred: labels.has(LABEL_STARRED),
        snoozedUntil: snapshot.snoozedUntil ?? null,
      });
    } catch (error) {
      console.warn("Failed to rollback local email patch", error);
    }
  }
}

async function patchEmails(
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
  const beforeLocal = await localDb.getEmailsByProviderMessageIds(userId, providerIds);
  const beforeLocalByProviderId = new Map(
    beforeLocal.map((email) => [email.providerMessageId, email]),
  );
  const unreadCountSnapshot = queryClient.getQueryData<InboxUnreadCount>(
    emailQueryKeys.inboxUnreadCount(mailboxId),
  );
  const unreadDelta = computeUnreadDeltaForEmails(
    emails.map(
      (email) =>
        beforeLocalByProviderId.get(email.providerMessageId) ?? {
          labelIds: email.labelIds ?? [],
        },
    ),
    data,
  );
  await queryClient.cancelQueries({ queryKey: emailQueryKeys.all() });
  await queryClient.cancelQueries({
    queryKey: emailQueryKeys.inboxUnreadCount(mailboxId),
  });
  await Promise.all(
    emailIds.map((id) =>
      queryClient.cancelQueries({ queryKey: emailQueryKeys.detail(id) }),
    ),
  );
  applyOptimisticCachePatch(emailIdSet, data);
  applyInboxUnreadDelta(mailboxId, unreadDelta);
  const localPatchTask = applyLocalPatch(
    userId,
    toNumericIds(emailIds),
    data,
  );
  markPending(providerIds);
  let requestSucceeded = false;

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
    } else {
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
    }
    await localPatchTask;
    requestSucceeded = true;
  } finally {
    await localPatchTask;
    if (!requestSucceeded) {
      await rollbackLocalPatch(userId, beforeLocal);
      restoreInboxUnreadCount(mailboxId, unreadCountSnapshot);
    } else {
      invalidateInboxUnreadCount(mailboxId);
      if (data.snoozedUntil !== undefined) {
        void queryClient.invalidateQueries({
          queryKey: emailQueryKeys.list("inbox", mailboxId),
        });
      }
    }
    clearPending(providerIds);
  }
}

export async function patchThread(
  thread: ThreadIdentifier,
  data: EmailPatchPayload,
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");

  const beforeLocal = await localDb.getEmailThread(userId, thread.threadId);
  const unreadCountSnapshot = queryClient.getQueryData<InboxUnreadCount>(
    emailQueryKeys.inboxUnreadCount(thread.mailboxId),
  );
  const unreadDelta = computeUnreadDeltaForThread(
    beforeLocal,
    thread.labelIds,
    data,
  );
  await queryClient.cancelQueries({ queryKey: emailQueryKeys.all() });
  await queryClient.cancelQueries({
    queryKey: emailQueryKeys.thread(thread.threadId),
  });
  await queryClient.cancelQueries({
    queryKey: emailQueryKeys.inboxUnreadCount(thread.mailboxId),
  });
  applyOptimisticThreadPatch(thread.threadId, data);
  applyInboxUnreadDelta(thread.mailboxId, unreadDelta);
  const localPatchTask = localDb.updateThread(userId, thread.threadId, data);

  let requestSucceeded = false;
  try {
    const response = await fetch(
      `/api/inbox/emails/threads/${encodeURIComponent(thread.threadId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailboxId: thread.mailboxId,
          labelIds: thread.labelIds ?? [],
          ...data,
        }),
      },
    );
    if (!response.ok) throw await responseError(response, "Failed to update thread");
    await localPatchTask;
    requestSucceeded = true;
  } finally {
    await localPatchTask;
    if (!requestSucceeded) {
      await rollbackLocalPatch(userId, beforeLocal);
      restoreInboxUnreadCount(thread.mailboxId, unreadCountSnapshot);
      void queryClient.invalidateQueries({ queryKey: emailQueryKeys.all() });
      void queryClient.invalidateQueries({
        queryKey: emailQueryKeys.thread(thread.threadId),
      });
    } else {
      invalidateInboxUnreadCount(thread.mailboxId);
      if (data.snoozedUntil !== undefined) {
        void queryClient.invalidateQueries({
          queryKey: emailQueryKeys.list("inbox", thread.mailboxId),
        });
      }
    }
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

  const unreadCountSnapshot = queryClient.getQueryData<InboxUnreadCount>(
    emailQueryKeys.inboxUnreadCount(email.mailboxId),
  );
  const unreadDelta = {
    messagesUnread: isUnreadInboxLabelSet(email.labelIds ?? []) ? -1 : 0,
    threadsUnread: isUnreadInboxLabelSet(email.labelIds ?? []) ? -1 : 0,
  };
  await queryClient.cancelQueries({
    queryKey: emailQueryKeys.inboxUnreadCount(email.mailboxId),
  });
  applyInboxUnreadDelta(email.mailboxId, unreadDelta);

  let requestSucceeded = false;
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
    requestSucceeded = true;
  } finally {
    if (requestSucceeded) {
      invalidateInboxUnreadCount(email.mailboxId);
    } else {
      restoreInboxUnreadCount(email.mailboxId, unreadCountSnapshot);
    }
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

export type CalendarInviteResponseResult = {
  inviteUid: string;
  responseStatus: "accepted" | "declined";
  selfResponseStatus: CalendarInviteResponseStatus | null;
};

export async function respondToCalendarInvite(input: {
  mailboxId: number;
  inviteUid: string;
  response: "accepted" | "declined";
}): Promise<CalendarInviteResponseResult> {
  const response = await fetch("/api/inbox/calendar/respond", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const json = (await response.json().catch(() => null)) as
    | {
        data?: CalendarInviteResponseResult;
        error?: string;
      }
    | null;

  if (!response.ok || !json?.data) {
    throw new Error(json?.error ?? "Failed to respond to calendar invite");
  }

  return json.data;
}
