import { and, eq } from "drizzle-orm";
import { checklistItems, checklists, projects } from "../../db/schema";
import { forbidden, notFound } from "../../lib/errors";
import type { AuthUser } from "../../auth/middleware";
import type { Database } from "../../db/client";

export async function verifyProjectAccess(db: Database, user: AuthUser, projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw notFound("Project not found");
  if (!user.orgs.some((org) => org.orgId === project.orgId)) throw forbidden();
  return project;
}

export async function loadChecklistWithItems(db: Database, checklistId: string) {
  const checklist = await db.query.checklists.findFirst({
    where: eq(checklists.id, checklistId),
  });
  if (!checklist) throw notFound("Checklist not found");

  const items = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.checklistId, checklistId))
    .orderBy(checklistItems.sortOrder);

  return {
    ...checklist,
    targetTraits: checklist.targetTraits ? JSON.parse(checklist.targetTraits) : null,
    items,
  };
}

export async function verifyChecklistAccess(db: Database, user: AuthUser, checklistId: string) {
  const checklist = await db.query.checklists.findFirst({
    where: eq(checklists.id, checklistId),
  });
  if (!checklist) throw notFound("Checklist not found");

  await verifyProjectAccess(db, user, checklist.projectId);
  return checklist;
}

export async function verifyChecklistItemAccess(
  db: Database,
  checklistId: string,
  itemId: string
) {
  const item = await db.query.checklistItems.findFirst({
    where: and(eq(checklistItems.id, itemId), eq(checklistItems.checklistId, checklistId)),
  });
  if (!item) throw notFound("Checklist item not found");
  return item;
}
