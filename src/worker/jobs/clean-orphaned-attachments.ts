import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { scheduledEmails } from "../db/schema";

const ORPHAN_ATTACHMENT_AGE_MS = 60 * 60 * 1000; // 1 hour

export async function cleanOrphanedAttachments(db: Database, env: Env) {
  const bucket = env.ATTACHMENTS;
  const cutoff = new Date(Date.now() - ORPHAN_ATTACHMENT_AGE_MS);
  const listed = await bucket.list({ prefix: "attachments/", limit: 100 });

  const stale = listed.objects.filter((obj) => obj.uploaded < cutoff);
  if (stale.length === 0) return;

  const pending = await db
    .select({ attachmentKeys: scheduledEmails.attachmentKeys })
    .from(scheduledEmails)
    .where(eq(scheduledEmails.status, "pending"));

  const inUse = new Set<string>();
  for (const row of pending) {
    if (row.attachmentKeys) {
      for (const att of row.attachmentKeys) inUse.add(att.key);
    }
  }

  const toDelete = stale.filter((obj) => !inUse.has(obj.key));
  if (toDelete.length === 0) return;

  await Promise.allSettled(
    toDelete.map((obj) => bucket.delete(obj.key)),
  );
  console.log(`Cleaned ${toDelete.length} orphaned attachments`);
}
