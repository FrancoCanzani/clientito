import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { releases } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { verifyReleaseAccess } from "./helpers";

export async function deleteReleaseById(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const releaseId = c.req.param("rid");

  await verifyReleaseAccess(db, user, releaseId);

  await db.delete(releases).where(eq(releases.id, releaseId));
  return c.json({ ok: true });
}
