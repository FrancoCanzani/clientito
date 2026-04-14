/**
 * Labels are now fetched on-demand from Gmail via proxy endpoints.
 * Email sync is browser-driven via POST /api/inbox/sync/pull.
 * This cron handler is a no-op placeholder.
 */
import type { Database } from "../db/client";

export async function syncMailboxes(_db: Database, _env: Env) {
  // No-op: labels and emails are now fetched on-demand
}
