import type { Context } from "hono";
import { desc, eq } from "drizzle-orm";
import { badRequest } from "../../lib/errors";
import { releases } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { verifyProjectAccess, verifyReleaseAccess } from "./helpers";

export async function getReleases(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const projectId = c.req.query("projectId");
  if (!projectId) throw badRequest("projectId query param required");

  await verifyProjectAccess(db, user, projectId);

  const data = await db
    .select()
    .from(releases)
    .where(eq(releases.projectId, projectId))
    .orderBy(desc(releases.createdAt));

  return c.json({ data });
}

export async function getReleaseById(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const releaseId = c.req.param("rid");

  const release = await verifyReleaseAccess(db, user, releaseId);
  return c.json({ data: release });
}
