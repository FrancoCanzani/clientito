import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { queryClient } from "@/lib/query-client";
import {
  fetchEmailThread,
  fetchRemoteEmailThread,
} from "@/features/email/mail/shared/data/thread-detail";
import { emailQueryKeys } from "@/features/email/mail/shared/query-keys";
import type { EmailListItem, EmailThreadItem } from "@/features/email/mail/shared/types";
import { fetchThreadSummary } from "./queries";
import { aiQueryKeys } from "./query-keys";
import { createReplyDraft } from "./mutations";
import {
  getLatestThreadMessage,
} from "./types";
import { accountsQueryOptions, getMailboxDisplayEmail } from "@/hooks/use-mailboxes";

const prefetchInFlight = new Set<string>();

function shouldSkipSummary(email: EmailListItem) {
  return Boolean(
    email.unsubscribeUrl ||
      email.unsubscribeEmail ||
      email.labelIds.includes("CATEGORY_PROMOTIONS"),
  );
}

function hasBodies(messages: EmailThreadItem[]) {
  return messages.every(
    (message) =>
      message.bodyText !== null ||
      message.bodyHtml !== null ||
      message.resolvedBodyText !== null ||
      message.resolvedBodyHtml !== null,
  );
}

export async function prefetchThreadAi(email: EmailListItem) {
  if (!email.mailboxId || !email.threadId || shouldSkipSummary(email)) return;

  const key = `${email.mailboxId}:${email.threadId}`;
  if (prefetchInFlight.has(key)) return;
  prefetchInFlight.add(key);

  try {
    await fetchRemoteEmailThread({
      mailboxId: email.mailboxId,
      threadId: email.threadId,
    });

    await fetchEmailThread(email.threadId);

    const userId = await getCurrentUserId();
    if (!userId) return;
    const bodies = await localDb.getEmailThreadBodies(userId, email.threadId);
    const cachedMessages =
      queryClient.getQueryData<EmailThreadItem[]>(
        emailQueryKeys.thread(email.threadId),
      ) ?? [];
    const messages = cachedMessages.map((message) => {
      const body = bodies.get(message.id);
      return body
        ? {
            ...message,
            bodyText: body.bodyText,
            bodyHtml: body.bodyHtml,
            resolvedBodyText: body.bodyText,
            resolvedBodyHtml: body.bodyHtml,
          }
        : message;
    });
    if (messages.length === 0 || !hasBodies(messages)) return;

    const summaryPrefetch = queryClient.prefetchQuery({
      queryKey: aiQueryKeys.threadSummary(
        email.mailboxId,
        email.threadId,
        messages[messages.length - 1]?.providerMessageId ?? "none",
        messages.length,
      ),
      queryFn: () =>
        fetchThreadSummary({
          mailboxId: email.mailboxId!,
          threadId: email.threadId!,
          messages,
        }),
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    });

    const accounts = await queryClient.ensureQueryData(accountsQueryOptions);
    const account =
      accounts.accounts.find((entry) => entry.mailboxId === email.mailboxId) ??
      null;
    const selfEmails = new Set(
      [account?.email, account?.gmailEmail, account && getMailboxDisplayEmail(account)]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase()),
    );
    const latestMessage = getLatestThreadMessage(messages);
    const draftPrefetch =
      latestMessage && !selfEmails.has(latestMessage.fromAddr.toLowerCase())
        ? queryClient.prefetchQuery({
            queryKey: aiQueryKeys.replyDraft(
              email.mailboxId,
              email.threadId,
              latestMessage.providerMessageId,
              messages.length,
            ),
            queryFn: () =>
              createReplyDraft({
                mailboxId: email.mailboxId!,
                threadId: email.threadId!,
                messages,
              }),
            staleTime: 60_000,
            gcTime: 5 * 60_000,
          })
        : null;

    await Promise.allSettled(
      draftPrefetch ? [summaryPrefetch, draftPrefetch] : [summaryPrefetch],
    );
  } finally {
    prefetchInFlight.delete(key);
  }
}
