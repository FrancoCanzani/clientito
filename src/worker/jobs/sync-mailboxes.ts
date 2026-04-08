import { and, eq, isNotNull, lt, or, isNull } from "drizzle-orm";
import type { Database } from "../db/client";
import { mailboxes } from "../db/schema";
import { catchUpMailboxOnDemand } from "../lib/gmail/sync/engine";

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export async function syncMailboxes(db: Database, env: Env) {
  const staleThreshold = Date.now() - SYNC_INTERVAL_MS;

  const eligibleMailboxes = await db
    .select({
      id: mailboxes.id,
      userId: mailboxes.userId,
    })
    .from(mailboxes)
    .where(
      and(
        isNotNull(mailboxes.historyId),
        eq(mailboxes.authState, "ok"),
        or(
          isNull(mailboxes.lastSuccessfulSyncAt),
          lt(mailboxes.lastSuccessfulSyncAt, staleThreshold),
        ),
      ),
    );

  if (eligibleMailboxes.length === 0) return;

  const results = await Promise.allSettled(
    eligibleMailboxes.map((mb) =>
      catchUpMailboxOnDemand(db, env, mb.id, mb.userId).catch((err) => {
        console.error("Scheduled sync failed", {
          mailboxId: mb.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }),
    ),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  console.log("Scheduled sync complete", {
    total: eligibleMailboxes.length,
    succeeded,
    failed,
  });
}
