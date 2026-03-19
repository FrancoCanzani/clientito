import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import {
  emailFilters,
  type FilterActions,
  type FilterCondition,
} from "../db/schema";

type EmailFields = {
  fromAddr: string;
  toAddr: string | null;
  subject: string | null;
  aiLabel: string | null;
};

function matchesCondition(
  email: EmailFields,
  condition: FilterCondition,
): boolean {
  let fieldValue: string;
  switch (condition.field) {
    case "from":
      fieldValue = email.fromAddr;
      break;
    case "to":
      fieldValue = email.toAddr ?? "";
      break;
    case "subject":
      fieldValue = email.subject ?? "";
      break;
    case "aiLabel":
      fieldValue = email.aiLabel ?? "";
      break;
    default:
      return false;
  }

  const value = condition.value.toLowerCase();
  const field = fieldValue.toLowerCase();

  switch (condition.operator) {
    case "contains":
      return field.includes(value);
    case "equals":
      return field === value;
    case "startsWith":
      return field.startsWith(value);
    case "endsWith":
      return field.endsWith(value);
    default:
      return false;
  }
}

function matchesAllConditions(
  email: EmailFields,
  conditions: FilterCondition[],
): boolean {
  return conditions.every((c) => matchesCondition(email, c));
}

export async function getUserFilters(
  db: Database,
  userId: string,
): Promise<
  Array<{
    conditions: FilterCondition[];
    actions: FilterActions;
  }>
> {
  const rows = await db
    .select({
      conditions: emailFilters.conditions,
      actions: emailFilters.actions,
    })
    .from(emailFilters)
    .where(
      and(eq(emailFilters.userId, userId), eq(emailFilters.enabled, true)),
    )
    .orderBy(asc(emailFilters.priority));

  return rows.filter(
    (r) =>
      Array.isArray(r.conditions) &&
      r.conditions.length > 0 &&
      r.actions !== null,
  );
}

export function applyFilters(
  email: EmailFields,
  filters: Array<{ conditions: FilterCondition[]; actions: FilterActions }>,
): FilterActions | null {
  for (const filter of filters) {
    if (matchesAllConditions(email, filter.conditions)) {
      return filter.actions;
    }
  }
  return null;
}
