import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { reminders } from "../../db/schema";

export async function getReminderById(
  db: Database,
  id: string,
) {
  return db.query.reminders.findFirst({ where: eq(reminders.id, id) });
}
