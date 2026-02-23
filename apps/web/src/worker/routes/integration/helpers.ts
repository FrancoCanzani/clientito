import { eq } from "drizzle-orm";
import { PLAN_LIMITS, type Plan } from "@releaselayer/shared";
import { integrations, organizations, projects } from "../../db/schema";
import { forbidden, notFound } from "../../lib/errors";
import type { AuthUser } from "../../auth/middleware";
import type { Database } from "../../db/client";

export async function verifyProjectAccess(db: Database, user: AuthUser, projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw notFound("Project not found");

  const membership = user.orgs.find((org) => org.orgId === project.orgId);
  if (!membership) throw forbidden();

  return { project, membership };
}

export async function verifyIntegrationAccess(db: Database, user: AuthUser, integrationId: string) {
  const integration = await db.query.integrations.findFirst({
    where: eq(integrations.id, integrationId),
  });
  if (!integration) throw notFound("Integration not found");

  const { project, membership } = await verifyProjectAccess(db, user, integration.projectId);
  return { integration, project, membership };
}

export function assertCanManageIntegrations(role: string) {
  if (role === "member") throw forbidden("Only admins/owners can manage integrations");
}

export async function assertIntegrationsEnabledByPlan(db: Database, orgId: string) {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });
  if (!org) throw notFound("Organization not found");

  const limits = PLAN_LIMITS[org.plan as Plan];
  if (!limits.integrations) {
    throw forbidden("Current plan does not include integrations");
  }
}
