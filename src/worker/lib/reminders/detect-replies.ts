import { and, eq, inArray, or } from "drizzle-orm";
import type { Database } from "../../db/client";
import { replyReminders } from "../../db/schema";
import { GmailDriver } from "../gmail/driver";
import { ensureAwaitingReplyLabel } from "../gmail/mailbox/awaiting-reply-label";

type DeltaMessage = {
  threadId: string | null;
  labelIds: string[];
};

const SENT_LABEL = "SENT";

export async function markRepliedReminders(
  db: Database,
  env: Env,
  userId: string,
  mailboxId: number,
  added: DeltaMessage[],
): Promise<void> {
  if (added.length === 0) return;

  const inboundThreadIds = new Set<string>();
  for (const message of added) {
    if (!message.threadId) continue;
    if (message.labelIds.includes(SENT_LABEL)) continue;
    inboundThreadIds.add(message.threadId);
  }
  if (inboundThreadIds.size === 0) return;

  const candidates = await db
    .select({
      id: replyReminders.id,
      threadId: replyReminders.threadId,
      status: replyReminders.status,
    })
    .from(replyReminders)
    .where(
      and(
        eq(replyReminders.userId, userId),
        eq(replyReminders.mailboxId, mailboxId),
        or(
          eq(replyReminders.status, "pending"),
          eq(replyReminders.status, "surfaced"),
        ),
        inArray(replyReminders.threadId, [...inboundThreadIds]),
      ),
    );

  if (candidates.length === 0) return;

  const surfacedThreads = candidates
    .filter((row) => row.status === "surfaced")
    .map((row) => row.threadId);

  await db
    .update(replyReminders)
    .set({ status: "replied" })
    .where(
      inArray(
        replyReminders.id,
        candidates.map((row) => row.id),
      ),
    );

  if (surfacedThreads.length === 0) return;

  try {
    const labelId = await ensureAwaitingReplyLabel(db, env, mailboxId);
    const provider = new GmailDriver(db, env, mailboxId);
    await Promise.all(
      surfacedThreads.map((threadId) =>
        provider
          .modifyThreadLabels(threadId, [], [labelId])
          .catch((error) => {
            console.warn("Failed to remove awaiting-reply label after reply", {
              threadId,
              error: error instanceof Error ? error.message : String(error),
            });
          }),
      ),
    );
  } catch (error) {
    console.warn("Failed to ensure awaiting-reply label for reply detection", {
      mailboxId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
