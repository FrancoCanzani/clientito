import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { checklistItems, checklists } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  verifyChecklistAccess,
  verifyChecklistItemAccess,
} from "./helpers";

export async function deleteChecklistById(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const checklistId = c.req.param("cid");

  await verifyChecklistAccess(db, user, checklistId);
  await db.delete(checklists).where(eq(checklists.id, checklistId));

  return c.json({ ok: true });
}

export async function deleteChecklistItem(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const checklistId = c.req.param("cid");
  const itemId = c.req.param("itemId");

  await verifyChecklistAccess(db, user, checklistId);
  await verifyChecklistItemAccess(db, checklistId, itemId);

  await db.delete(checklistItems).where(eq(checklistItems.id, itemId));
  return c.json({ ok: true });
}
