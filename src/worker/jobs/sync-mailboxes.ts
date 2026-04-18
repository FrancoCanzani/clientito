/**
 * Labels are now fetched on-demand from Gmail via proxy endpoints.
 * Email list/search pages are fetched on-demand via inbox view/search endpoints.
 * This cron handler is a no-op placeholder.
 */
import type { Database } from "../db/client";

export async function syncMailboxes(_db: Database, _env: Env) {
  // No-op: labels and emails are now fetched on-demand
}
