import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { integrations } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { assertCanManageIntegrations, verifyIntegrationAccess } from "./helpers";

export async function deleteIntegrationById(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const integrationId = c.req.param("iid");

  const { membership } = await verifyIntegrationAccess(db, user, integrationId);
  assertCanManageIntegrations(membership.role);

  await db.delete(integrations).where(eq(integrations.id, integrationId));
  return c.json({ ok: true });
}
