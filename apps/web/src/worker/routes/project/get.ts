import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { badRequest } from "../../lib/errors";
import { projects } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { requireOrgMembership, verifyProjectAccess } from "./helpers";

export async function getProjects(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const orgId = c.req.query("orgId");

  if (!orgId) throw badRequest("orgId query param required");
  requireOrgMembership(user, orgId);

  const data = await db.select().from(projects).where(eq(projects.orgId, orgId));
  return c.json({ data });
}

export async function getProjectById(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const projectId = c.req.param("pid");

  const { project } = await verifyProjectAccess(db, user, projectId);
  return c.json({ data: project });
}
