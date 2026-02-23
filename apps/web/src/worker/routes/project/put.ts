import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { updateProjectSchema } from "@releaselayer/shared";
import { badRequest } from "../../lib/errors";
import { parseJsonBody } from "../../lib/request";
import { projects } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { verifyProjectAccess } from "./helpers";

export async function updateProjectById(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  const db = c.get("db");
  const projectId = c.req.param("pid");
  const body = await parseJsonBody<unknown>(c);
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid project payload");

  await verifyProjectAccess(db, user, projectId);

  await db
    .update(projects)
    .set({
      ...parsed.data,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(projects.id, projectId));

  const updated = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  return c.json({ data: updated });
}
