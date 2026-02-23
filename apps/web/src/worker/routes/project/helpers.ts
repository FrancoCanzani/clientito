import { and, count, eq } from "drizzle-orm";
import { PLAN_LIMITS, type Plan } from "@releaselayer/shared";
import { organizations, projects } from "../../db/schema";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import type { AuthUser } from "../../auth/middleware";
import type { Database } from "../../db/client";

export function requireOrgMembership(user: AuthUser, orgId: string) {
  const membership = user.orgs.find((org) => org.orgId === orgId);
  if (!membership) throw forbidden();
  return membership;
}

export async function verifyProjectAccess(db: Database, user: AuthUser, projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw notFound("Project not found");

  const membership = user.orgs.find((org) => org.orgId === project.orgId);
  if (!membership) throw forbidden();

  return { project, membership };
}

export async function assertProjectLimit(db: Database, orgId: string) {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });
  if (!org) throw notFound("Organization not found");

  const [{ value: projectCount }] = await db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.orgId, orgId));

  const limits = PLAN_LIMITS[org.plan as Plan];
  if (projectCount >= limits.projectsLimit) {
    throw forbidden(`Plan limit: max ${limits.projectsLimit} projects`);
  }
}

export async function assertProjectSlugAvailable(db: Database, orgId: string, slug: string) {
  const existing = await db.query.projects.findFirst({
    where: and(eq(projects.orgId, orgId), eq(projects.slug, slug)),
  });
  if (existing) throw badRequest("Project slug already taken in this org");
}
