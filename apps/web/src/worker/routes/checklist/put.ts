import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { checklistItems, checklists } from "../../db/schema";
import { badRequest } from "../../lib/errors";
import { parseJsonBody } from "../../lib/request";
import type { AppRouteEnv } from "../types";
import {
  loadChecklistWithItems,
  verifyChecklistAccess,
  verifyChecklistItemAccess,
} from "./helpers";
import { updateChecklistItemSchema, updateChecklistSchema } from "./schemas";

export async function updateChecklistById(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const checklistId = c.req.param("cid");

  await verifyChecklistAccess(db, user, checklistId);

  const body = await parseJsonBody<unknown>(c);
  const parsed = updateChecklistSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid checklist payload");

  const { targetTraits, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };

  if (targetTraits !== undefined) {
    updateData.targetTraits = targetTraits ? JSON.stringify(targetTraits) : null;
  }

  if (Object.keys(updateData).length === 0) {
    throw badRequest("No fields to update");
  }

  await db.update(checklists).set(updateData).where(eq(checklists.id, checklistId));

  const updated = await loadChecklistWithItems(db, checklistId);
  return c.json({ data: updated });
}

export async function updateChecklistItem(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const checklistId = c.req.param("cid");
  const itemId = c.req.param("itemId");

  await verifyChecklistAccess(db, user, checklistId);
  await verifyChecklistItemAccess(db, checklistId, itemId);

  const body = await parseJsonBody<unknown>(c);
  const parsed = updateChecklistItemSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid checklist item payload");
  if (Object.keys(parsed.data).length === 0) throw badRequest("No fields to update");

  await db.update(checklistItems).set(parsed.data).where(eq(checklistItems.id, itemId));

  const updated = await db.query.checklistItems.findFirst({
    where: eq(checklistItems.id, itemId),
  });

  return c.json({ data: updated });
}
