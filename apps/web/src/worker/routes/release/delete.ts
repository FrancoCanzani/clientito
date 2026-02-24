import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { orgMembers, projects, releases } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { deleteReleaseResponseSchema } from "./schemas";

const errorResponseSchema = z.object({ error: z.string() });

const route = createRoute({
  method: "delete",
  path: "/:releaseId",
  tags: ["releases"],
  summary: "Delete release",
  request: {
    params: z.object({ releaseId: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: deleteReleaseResponseSchema } },
      description: "Release deleted",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
    403: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Forbidden",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Not found",
    },
  },
});

export function registerDeleteRelease(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(route, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { releaseId } = c.req.valid("param");

    const release = await db.query.releases.findFirst({
      where: eq(releases.id, releaseId),
    });
    if (!release) return c.json({ error: "Not found" }, 404);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, release.projectId),
    });
    if (!project) return c.json({ error: "Not found" }, 404);

    const membership = await db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, project.orgId), eq(orgMembers.userId, user.id)),
    });
    if (!membership) return c.json({ error: "Forbidden" }, 403 as any);

    await db.delete(releases).where(eq(releases.id, releaseId));

    return c.json({ success: true }, 200);
  });
}
