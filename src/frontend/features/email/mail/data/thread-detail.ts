import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import type {
  EmailDetailItem,
  EmailThreadItem,
} from "@/features/email/mail/types";
import { queryClient } from "@/lib/query-client";
import { alignActiveUser, persistEmails } from "./local-cache";
import type { PulledEmail } from "./types";

const threadHydrationInFlight = new Map<string, Promise<void>>();

export async function fetchRemoteEmailThread(params: {
  mailboxId: number;
  threadId: string;
}): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId || !params.mailboxId || !params.threadId) return;

  await alignActiveUser(userId);

  const key = `${params.mailboxId}:${params.threadId}`;
  const existing = threadHydrationInFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const res = await fetch("/api/inbox/emails/thread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mailboxId: params.mailboxId,
        threadId: params.threadId,
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to load thread: ${res.status}`);
    }
    const body = (await res.json()) as { emails: PulledEmail[] };
    if (body.emails?.length) {
      await persistEmails(body.emails, userId, params.mailboxId);
      void queryClient.invalidateQueries({
        queryKey: emailQueryKeys.thread(params.threadId),
      });
    }
  })().finally(() => {
    threadHydrationInFlight.delete(key);
  });

  threadHydrationInFlight.set(key, promise);
  return promise;
}

export async function fetchEmailDetail(
  emailId: string,
  context?: { mailboxId?: number; view?: string },
): Promise<EmailDetailItem> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");

  const numericId = Number(emailId);
  const local = await localDb.getEmailDetail(userId, numericId);
  if (!local) throw new Error("Email not found in local database");

  if (local.bodyHtml || local.bodyText) return local;

  const mailboxId = context?.mailboxId ?? local.mailboxId ?? null;
  const threadId = local.threadId ?? null;
  if (!mailboxId || !threadId) return local;

  await fetchRemoteEmailThread({ mailboxId, threadId });
  const hydrated = await localDb.getEmailDetail(userId, numericId);
  return hydrated ?? local;
}

export async function fetchEmailThread(
  threadId: string,
): Promise<EmailThreadItem[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  return localDb.getEmailThread(userId, threadId);
}
