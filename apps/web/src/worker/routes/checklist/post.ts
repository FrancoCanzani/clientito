import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { checklistItems, checklists } from "../../db/schema";
import { badRequest } from "../../lib/errors";
import { parseJsonBody } from "../../lib/request";
import { generateId } from "../../lib/slug";
import type { AppRouteEnv } from "../types";
import {
  loadChecklistWithItems,
  verifyChecklistAccess,
  verifyProjectAccess,
} from "./helpers";
import { checklistItemSchema, createChecklistWithItemsSchema } from "./schemas";

export async function createChecklist(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const projectId = c.req.query("projectId");
  if (!projectId) throw badRequest("projectId query param required");

  await verifyProjectAccess(db, user, projectId);

  const body = await parseJsonBody<unknown>(c);
  const parsed = createChecklistWithItemsSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid checklist payload");

  const checklistId = generateId();
  const now = Math.floor(Date.now() / 1000);
  const { targetTraits, items, ...rest } = parsed.data;

  await db.insert(checklists).values({
    id: checklistId,
    projectId,
    ...rest,
    targetTraits: targetTraits ? JSON.stringify(targetTraits) : null,
    createdAt: now,
  });

  if (items && items.length > 0) {
    await db.insert(checklistItems).values(
      items.map((item) => ({
        id: generateId(),
        checklistId,
        title: item.title,
        description: item.description ?? null,
        trackEvent: item.trackEvent,
        sortOrder: item.sortOrder ?? 0,
        createdAt: now,
      }))
    );
  }

  const created = await loadChecklistWithItems(db, checklistId);
  return c.json({ data: created }, 201);
}

export async function createChecklistItem(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const checklistId = c.req.param("cid");

  await verifyChecklistAccess(db, user, checklistId);

  const body = await parseJsonBody<unknown>(c);
  const parsed = checklistItemSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid checklist item payload");

  const itemId = generateId();
  await db.insert(checklistItems).values({
    id: itemId,
    checklistId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    trackEvent: parsed.data.trackEvent,
    sortOrder: parsed.data.sortOrder ?? 0,
    createdAt: Math.floor(Date.now() / 1000),
  });

  const item = await db.query.checklistItems.findFirst({
    where: eq(checklistItems.id, itemId),
  });

  return c.json({ data: item }, 201);
}
