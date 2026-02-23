import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { forbidden } from "../../lib/errors";
import { projects } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { verifyProjectAccess } from "./helpers";

export async function deleteProjectById(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const projectId = c.req.param("pid");

  const { project, membership } = await verifyProjectAccess(db, user, projectId);
  if (membership.role === "member") throw forbidden();

  await db.delete(projects).where(eq(projects.id, project.id));
  return c.json({ ok: true });
}
