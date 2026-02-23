import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { createIntegrationSchema } from "@releaselayer/shared";
import { badRequest } from "../../lib/errors";
import { parseJsonBody } from "../../lib/request";
import { generateId } from "../../lib/slug";
import { integrations } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  assertCanManageIntegrations,
  assertIntegrationsEnabledByPlan,
  verifyIntegrationAccess,
  verifyProjectAccess,
} from "./helpers";

function withParsedConfig<T extends { config: string }>(row: T) {
  return { ...row, config: JSON.parse(row.config) };
}

export async function createIntegration(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const projectId = c.req.query("projectId");
  if (!projectId) throw badRequest("projectId query param required");

  const { project, membership } = await verifyProjectAccess(db, user, projectId);
  assertCanManageIntegrations(membership.role);
  await assertIntegrationsEnabledByPlan(db, project.orgId);

  const body = await parseJsonBody<unknown>(c);
  const parsed = createIntegrationSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid integration payload");

  const integrationId = generateId();
  await db.insert(integrations).values({
    id: integrationId,
    projectId,
    type: parsed.data.type,
    config: JSON.stringify(parsed.data.config),
    isActive: parsed.data.isActive ?? true,
    createdAt: Math.floor(Date.now() / 1000),
  });

  const created = await db.query.integrations.findFirst({
    where: eq(integrations.id, integrationId),
  });

  return c.json({ data: created ? withParsedConfig(created) : null }, 201);
}

export async function toggleIntegration(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const integrationId = c.req.param("iid");

  const { integration, membership } = await verifyIntegrationAccess(db, user, integrationId);
  assertCanManageIntegrations(membership.role);

  const nextState = !integration.isActive;
  await db
    .update(integrations)
    .set({ isActive: nextState })
    .where(eq(integrations.id, integrationId));

  const updated = await db.query.integrations.findFirst({
    where: eq(integrations.id, integrationId),
  });

  return c.json({ data: updated ? withParsedConfig(updated) : null });
}
