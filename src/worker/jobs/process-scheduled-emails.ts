import { and, eq, lte } from "drizzle-orm";
import type { Database } from "../db/client";
import { mailboxes, scheduledEmails } from "../db/schema";
import { GmailDriver } from "../lib/gmail/driver";
import { resolveOutgoingMailbox } from "../lib/gmail/mailboxes";
import { appendSignature } from "../lib/gmail/mailbox/signature";

async function sendScheduledEmail(
  db: Database,
  env: Env,
  row: {
    id: number;
    userId: string;
    mailboxId: number;
    to: string;
    cc: string | null;
    bcc: string | null;
    subject: string;
    body: string;
    inReplyTo: string | null;
    references: string | null;
    threadId: string | null;
    attachmentKeys: Array<{
      key: string;
      filename: string;
      mimeType: string;
      disposition?: "attachment" | "inline";
      contentId?: string;
    }> | null;
  },
) {
  const mailbox = await resolveOutgoingMailbox(db, row.userId, row.mailboxId);

  const mbRow = await db
    .select({ signature: mailboxes.signature, email: mailboxes.email })
    .from(mailboxes)
    .where(eq(mailboxes.id, mailbox.id))
    .limit(1);
  const bodyWithSignature = appendSignature(row.body, mbRow[0]?.signature);

  let attachments:
    | Array<{
        filename: string;
        mimeType: string;
        content: ArrayBuffer;
        disposition?: "attachment" | "inline";
        contentId?: string;
      }>
    | undefined;
  if (row.attachmentKeys && row.attachmentKeys.length > 0) {
    const bucket = env.ATTACHMENTS;
    attachments = await Promise.all(
      row.attachmentKeys.map(async (att) => {
        const obj = await bucket.get(att.key);
        if (!obj) throw new Error(`Attachment not found: ${att.key}`);
        return {
          filename: att.filename,
          mimeType: att.mimeType,
          disposition: att.disposition,
          contentId: att.contentId,
          content: await obj.arrayBuffer(),
        };
      }),
    );
  }

  const provider = new GmailDriver(db, env, mailbox.id);
  await provider.send(mbRow[0]?.email ?? row.to, {
    to: row.to,
    cc: row.cc ?? undefined,
    bcc: row.bcc ?? undefined,
    subject: row.subject,
    body: bodyWithSignature,
    inReplyTo: row.inReplyTo ?? undefined,
    references: row.references ?? undefined,
    threadId: row.threadId ?? undefined,
    attachments,
  });

  if (row.attachmentKeys) {
    await Promise.allSettled(
      row.attachmentKeys.map((att) => env.ATTACHMENTS.delete(att.key)),
    );
  }
}

export async function processScheduledEmails(db: Database, env: Env) {
  const now = Date.now();

  const pending = await db
    .select({
      id: scheduledEmails.id,
      userId: scheduledEmails.userId,
      mailboxId: scheduledEmails.mailboxId,
      to: scheduledEmails.to,
      cc: scheduledEmails.cc,
      bcc: scheduledEmails.bcc,
      subject: scheduledEmails.subject,
      body: scheduledEmails.body,
      inReplyTo: scheduledEmails.inReplyTo,
      references: scheduledEmails.references,
      threadId: scheduledEmails.threadId,
      attachmentKeys: scheduledEmails.attachmentKeys,
      retryCount: scheduledEmails.retryCount,
    })
    .from(scheduledEmails)
    .where(
      and(
        eq(scheduledEmails.status, "pending"),
        lte(scheduledEmails.scheduledFor, now),
      ),
    )
    .limit(20);

  if (pending.length === 0) return;

  for (const row of pending) {
    try {
      await sendScheduledEmail(db, env, row);
      await db
        .delete(scheduledEmails)
        .where(eq(scheduledEmails.id, row.id));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const nextRetry = row.retryCount + 1;
      console.error("Scheduled email send failed", {
        id: row.id,
        attempt: nextRetry,
        error: errorMsg,
      });
      if (nextRetry >= 3) {
        await db
          .update(scheduledEmails)
          .set({ status: "failed", retryCount: nextRetry, error: errorMsg })
          .where(eq(scheduledEmails.id, row.id));
      } else {
        await db
          .update(scheduledEmails)
          .set({ retryCount: nextRetry, error: errorMsg })
          .where(eq(scheduledEmails.id, row.id));
      }
    }
  }
}
