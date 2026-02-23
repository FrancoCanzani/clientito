import type { Context } from "hono";
import { desc, eq } from "drizzle-orm";
import { badRequest } from "../../lib/errors";
import { checklists, checklistItems } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  loadChecklistWithItems,
  verifyChecklistAccess,
  verifyProjectAccess,
} from "./helpers";

export async function getChecklists(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const projectId = c.req.query("projectId");
  if (!projectId) throw badRequest("projectId query param required");

  await verifyProjectAccess(db, user, projectId);

  const list = await db
    .select()
    .from(checklists)
    .where(eq(checklists.projectId, projectId))
    .orderBy(desc(checklists.createdAt));

  const data = await Promise.all(
    list.map(async (checklist) => {
      const items = await db
        .select()
        .from(checklistItems)
        .where(eq(checklistItems.checklistId, checklist.id))
        .orderBy(checklistItems.sortOrder);

      return {
        ...checklist,
        targetTraits: checklist.targetTraits ? JSON.parse(checklist.targetTraits) : null,
        items,
      };
    })
  );

  return c.json({ data });
}

export async function getChecklistById(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const checklistId = c.req.param("cid");

  await verifyChecklistAccess(db, user, checklistId);
  const data = await loadChecklistWithItems(db, checklistId);

  return c.json({ data });
}
