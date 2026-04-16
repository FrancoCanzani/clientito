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

export async function persistMailboxHistoryState(
  db: Database,
  mailboxId: number,
  historyId: string | null,
): Promise<void> {
  if (!historyId) return;

  const mailbox = await db.query.mailboxes.findFirst({
    where: eq(mailboxes.id, mailboxId),
  });
  if (!mailbox) return;

  if (mailbox.historyId) {
    try {
      if (BigInt(historyId) <= BigInt(mailbox.historyId)) return;
    } catch {
      /* non-numeric historyId — overwrite */
    }
  }

  await db
    .update(mailboxes)
    .set({ historyId, updatedAt: Date.now() })
    .where(eq(mailboxes.id, mailboxId));
}

export async function resetMailboxSyncState(
  db: Database,
  mailboxId: number,
): Promise<void> {
  await db
    .update(mailboxes)
    .set({
      historyId: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      updatedAt: Date.now(),
    })
    .where(eq(mailboxes.id, mailboxId));
}
