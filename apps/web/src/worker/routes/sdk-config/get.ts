import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { notFound, forbidden } from "../../lib/errors";
import { projects, sdkConfigs } from "../../db/schema";
import type { AppRouteEnv } from "../types";

export async function getSdkConfigByProjectId(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const projectId = c.req.param("pid");

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw notFound("Project not found");
  if (!user.orgs.some((org) => org.orgId === project.orgId)) throw forbidden();

  const config = await db.query.sdkConfigs.findFirst({
    where: eq(sdkConfigs.projectId, projectId),
  });

  return c.json({ data: config, sdkKey: project.sdkKey });
}
