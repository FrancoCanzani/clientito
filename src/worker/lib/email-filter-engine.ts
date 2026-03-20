import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { emailFilters, type FilterActions } from "../db/schema";

type FilterWithActions = {
  id: number;
  description: string;
  actions: FilterActions;
};

export async function getUserFilters(
  db: Database,
  userId: string,
): Promise<FilterWithActions[]> {
  const rows = await db
    .select({
      id: emailFilters.id,
      description: emailFilters.description,
      actions: emailFilters.actions,
    })
    .from(emailFilters)
    .where(
      and(eq(emailFilters.userId, userId), eq(emailFilters.enabled, true)),
    )
    .orderBy(asc(emailFilters.priority));

  return rows.filter(
    (r) => r.description.trim().length > 0 && r.actions !== null,
  );
}
