import { and, eq } from "drizzle-orm";
import { projects, releases } from "../../db/schema";
import { badRequest, forbidden, notFound } from "../../lib/errors";
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

export async function verifyReleaseAccess(db: Database, user: AuthUser, releaseId: string) {
  const release = await db.query.releases.findFirst({
    where: eq(releases.id, releaseId),
  });
  if (!release) throw notFound("Release not found");

  await verifyProjectAccess(db, user, release.projectId);
  return release;
}

export async function assertReleaseSlugAvailable(db: Database, projectId: string, slug: string) {
  const existing = await db.query.releases.findFirst({
    where: and(eq(releases.projectId, projectId), eq(releases.slug, slug)),
  });
  if (existing) throw badRequest("Release slug already taken in this project");
}
