import { eq } from "drizzle-orm";
import type { Database } from "../../../db/client";
import { mailboxes } from "../../../db/schema";
import type { SyncWindowMonths } from "./preferences";

export async function getMailboxSyncPreferences(
  db: Database,
  mailboxId: number,
): Promise<{
  mailbox: typeof mailboxes.$inferSelect | null;
  syncWindowMonths: SyncWindowMonths | null;
  syncCutoffAt: number | null;
}> {
  const mailbox = await db.query.mailboxes.findFirst({
    where: eq(mailboxes.id, mailboxId),
  });
  return {
    mailbox: mailbox ?? null,
    syncWindowMonths:
      (mailbox?.syncWindowMonths as SyncWindowMonths | null) ?? null,
    syncCutoffAt: mailbox?.syncCutoffAt ?? null,
  };
}

export async function setMailboxSyncPreferences(
  db: Database,
  mailboxId: number,
  input: {
    syncWindowMonths: SyncWindowMonths | null;
    syncCutoffAt: number | null;
  },
): Promise<typeof mailboxes.$inferSelect | null> {
  const mailbox = await db.query.mailboxes.findFirst({
    where: eq(mailboxes.id, mailboxId),
  });
  if (!mailbox) return null;

  const now = Date.now();
  await db
    .update(mailboxes)
    .set({
      syncWindowMonths: input.syncWindowMonths,
      syncCutoffAt: input.syncCutoffAt,
      updatedAt: now,
    })
    .where(eq(mailboxes.id, mailbox.id));

  return {
    ...mailbox,
    syncWindowMonths: input.syncWindowMonths,
    syncCutoffAt: input.syncCutoffAt,
    updatedAt: now,
  };
}

