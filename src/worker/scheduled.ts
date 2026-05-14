import { createDb } from "./db/client";
import { cleanOrphanedAttachments } from "./jobs/clean-orphaned-attachments";
import { processScheduledEmails } from "./jobs/process-scheduled-emails";
import { surfaceReplyReminders } from "./jobs/surface-reply-reminders";

export async function handleScheduled(event: ScheduledEvent, env: Env) {
  const db = createDb(env.DB);

  switch (event.cron) {
    case "*/1 * * * *":
      await processScheduledEmails(db, env).catch((err) => {
        console.error("Scheduled email processing failed", err);
      });
      break;
    case "*/15 * * * *":
      await surfaceReplyReminders(db, env).catch((err) => {
        console.error("Reply reminder surfacing failed", err);
      });
      break;
    case "0 * * * *":
      await cleanOrphanedAttachments(db, env).catch((err) => {
        console.error("Orphaned attachment cleanup failed", err);
      });
      break;
  default:
      console.warn(`Unknown cron schedule: ${event.cron}`);
  }
}
