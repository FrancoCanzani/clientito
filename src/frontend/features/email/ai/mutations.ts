import type { EmailThreadItem } from "@/features/email/mail/shared/types";
import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import {
  accountsQueryOptions,
  getMailboxDisplayEmail,
} from "@/hooks/use-mailboxes";
import { queryClient } from "@/lib/query-client";
import {
  getLatestThreadMessage,
  toAiThreadMessages,
  type ReplyDraft,
  type SentStyleSample,
} from "./types";

export async function createReplyDraft(input: {
  mailboxId: number;
  threadId: string;
  messages: EmailThreadItem[];
}): Promise<ReplyDraft> {
  const userId = await getCurrentUserId();
  const accounts = await queryClient.ensureQueryData(accountsQueryOptions);
  const account =
    accounts.accounts.find((entry) => entry.mailboxId === input.mailboxId) ??
    null;
  const mailboxEmail = account ? getMailboxDisplayEmail(account) : null;
  const selfEmails = [
    account?.email,
    account?.gmailEmail,
    mailboxEmail,
  ].filter((email): email is string => Boolean(email));
  const latestMessage = getLatestThreadMessage(input.messages);
  const styleSamples: SentStyleSample[] = userId
    ? await localDb.getRecentSentStyleSamples(
        userId,
        input.mailboxId,
        input.threadId,
      )
    : [];
  const response = await fetch("/api/ai/reply-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mailboxId: input.mailboxId,
      threadId: input.threadId,
      messages: toAiThreadMessages(input.messages),
      styleSamples,
      selfEmails,
      mailboxEmail,
      replyToMessageId: latestMessage?.providerMessageId ?? null,
    }),
  });
  if (!response.ok) throw new Error("Failed to draft reply");
  return response.json();
}
