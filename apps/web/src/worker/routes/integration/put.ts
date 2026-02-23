import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { updateIntegrationSchema } from "@releaselayer/shared";
import { badRequest } from "../../lib/errors";
import { parseJsonBody } from "../../lib/request";
import { integrations } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { assertCanManageIntegrations, verifyIntegrationAccess } from "./helpers";

function withParsedConfig<T extends { config: string }>(row: T) {
  return { ...row, config: JSON.parse(row.config) };
}

export async function updateIntegrationById(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const integrationId = c.req.param("iid");

  const { membership } = await verifyIntegrationAccess(db, user, integrationId);
  assertCanManageIntegrations(membership.role);

  const body = await parseJsonBody<unknown>(c);
  const parsed = updateIntegrationSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid integration payload");
  if (Object.keys(parsed.data).length === 0) throw badRequest("No fields to update");

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.config !== undefined) {
    updateData.config = JSON.stringify(parsed.data.config);
  }

  await db.update(integrations).set(updateData).where(eq(integrations.id, integrationId));

  const updated = await db.query.integrations.findFirst({
    where: eq(integrations.id, integrationId),
  });

  return c.json({ data: updated ? withParsedConfig(updated) : null });
}
