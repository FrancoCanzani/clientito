import { and, eq, lte } from "drizzle-orm";
import type { Database } from "../db/client";
import { replyReminders } from "../db/schema";
import { GmailDriver } from "../lib/gmail/driver";
import { ensureAwaitingReplyLabel } from "../lib/gmail/mailbox/awaiting-reply-label";

const BATCH_LIMIT = 100;

export async function surfaceReplyReminders(
  db: Database,
  env: Env,
): Promise<void> {
  const now = Date.now();

  const due = await db
    .select({
      id: replyReminders.id,
      mailboxId: replyReminders.mailboxId,
      threadId: replyReminders.threadId,
    })
    .from(replyReminders)
    .where(
      and(
        eq(replyReminders.status, "pending"),
        lte(replyReminders.remindAt, now),
      ),
    )
    .limit(BATCH_LIMIT);

  if (due.length === 0) return;

  const byMailbox = new Map<number, typeof due>();
  for (const row of due) {
    const bucket = byMailbox.get(row.mailboxId) ?? [];
    bucket.push(row);
    byMailbox.set(row.mailboxId, bucket);
  }

  for (const [mailboxId, rows] of byMailbox) {
    let labelId: string;
    try {
      labelId = await ensureAwaitingReplyLabel(db, env, mailboxId);
    } catch (error) {
      console.warn("Failed to ensure awaiting-reply label; skipping mailbox", {
        mailboxId,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const provider = new GmailDriver(db, env, mailboxId);

    for (const row of rows) {
      try {
        await provider.modifyThreadLabels(row.threadId, [labelId], []);
        await db
          .update(replyReminders)
          .set({ status: "surfaced", surfacedAt: Date.now() })
          .where(eq(replyReminders.id, row.id));
      } catch (error) {
        console.warn("Failed to surface reply reminder", {
          reminderId: row.id,
          threadId: row.threadId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
