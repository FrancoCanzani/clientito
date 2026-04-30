import { createDb } from "./db/client";
import { cleanOrphanedAttachments } from "./jobs/clean-orphaned-attachments";
import { processScheduledEmails } from "./jobs/process-scheduled-emails";

export async function handleScheduled(event: ScheduledEvent, env: Env) {
  const db = createDb(env.DB);

  switch (event.cron) {
    case "*/1 * * * *":
      await processScheduledEmails(db, env);
      break;
    case "0 * * * *":
      await cleanOrphanedAttachments(db, env).catch((err) => {
        console.error("Orphaned attachment cleanup failed", err);
      });
      break;
  }
}
