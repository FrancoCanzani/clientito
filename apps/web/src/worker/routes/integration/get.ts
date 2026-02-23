import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { badRequest } from "../../lib/errors";
import { integrations } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { verifyIntegrationAccess, verifyProjectAccess } from "./helpers";

function withParsedConfig<T extends { config: string }>(row: T) {
  return { ...row, config: JSON.parse(row.config) };
}

export async function getIntegrations(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const projectId = c.req.query("projectId");
  if (!projectId) throw badRequest("projectId query param required");

  await verifyProjectAccess(db, user, projectId);

  const rows = await db
    .select()
    .from(integrations)
    .where(eq(integrations.projectId, projectId));

  return c.json({ data: rows.map(withParsedConfig) });
}

export async function getIntegrationById(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const integrationId = c.req.param("iid");

  const { integration } = await verifyIntegrationAccess(db, user, integrationId);
  return c.json({ data: withParsedConfig(integration) });
}
