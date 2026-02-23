import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { sdkConfigSchema } from "@releaselayer/shared";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import { parseJsonBody } from "../../lib/request";
import { projects, sdkConfigs } from "../../db/schema";
import type { AppRouteEnv } from "../types";

export async function updateSdkConfigByProjectId(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const projectId = c.req.param("pid");

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw notFound("Project not found");
  if (!user.orgs.some((org) => org.orgId === project.orgId)) throw forbidden();

  const body = await parseJsonBody<unknown>(c);
  const parsed = sdkConfigSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid SDK config payload");

  const { theme, ...rest } = parsed.data;
  await db
    .update(sdkConfigs)
    .set({
      ...rest,
      theme: JSON.stringify(theme),
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(sdkConfigs.projectId, projectId));

  const updated = await db.query.sdkConfigs.findFirst({
    where: eq(sdkConfigs.projectId, projectId),
  });

  return c.json({ data: updated });
}
