import { createDb } from "./db/client";
import { cleanOrphanedAttachments } from "./jobs/clean-orphaned-attachments";
import { processScheduledEmails } from "./jobs/process-scheduled-emails";
import { processPendingEmailIntelligence } from "./lib/email/intelligence/background-intelligence";
import { syncMailboxes } from "./jobs/sync-mailboxes";

export async function handleScheduled(event: ScheduledEvent, env: Env) {
  const db = createDb(env.DB);

  switch (event.cron) {
    case "*/1 * * * *":
      await processPendingEmailIntelligence(db, env);
      break;

    case "*/5 * * * *":
      await processScheduledEmails(db, env);
      await cleanOrphanedAttachments(db, env).catch((err) => {
        console.error("Orphaned attachment cleanup failed", err);
      });
      await syncMailboxes(db, env);
      break;
  }
}
