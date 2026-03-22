import type { Database } from "../../db/client";
import { getUserMailboxes } from "./mailbox-state";
import { catchUpMailboxOnDemand } from "./providers/google/sync";

export async function syncAllMailboxes(
  db: Database,
  env: Env,
  userId: string,
): Promise<void> {
  const mailboxes = await getUserMailboxes(db, userId);
  if (mailboxes.length === 0) return;

  await Promise.allSettled(
    mailboxes.map((mb) =>
      catchUpMailboxOnDemand(db, env, mb.id, userId).catch((err) => {
        console.error("syncAllMailboxes: mailbox failed", {
          mailboxId: mb.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }),
    ),
  );
}
