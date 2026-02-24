import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, eq } from "drizzle-orm";
import { orgMembers, projects, releases, releaseItems } from "../../db/schema";
import { unixNow, uniqueId } from "../../lib/slug";
import type { AppRouteEnv } from "../types";
import { updateReleaseRequestSchema, updateReleaseResponseSchema } from "./schemas";

const errorResponseSchema = z.object({ error: z.string() });

const route = createRoute({
  method: "put",
  path: "/:releaseId",
  tags: ["releases"],
  summary: "Update release",
  request: {
    params: z.object({ releaseId: z.string() }),
    body: {
      content: { "application/json": { schema: updateReleaseRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: updateReleaseResponseSchema } },
      description: "Release updated",
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

export function registerPutRelease(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(route, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { releaseId } = c.req.valid("param");
    const payload = c.req.valid("json");

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

    const now = unixNow();
    const updates: Record<string, unknown> = { updatedAt: now };

    if (payload.title !== undefined) updates.title = payload.title.trim();
    if (payload.version !== undefined) updates.version = payload.version.trim() || null;
    if (payload.notes !== undefined) updates.notes = payload.notes;
    if (payload.status !== undefined) {
      updates.status = payload.status;
      if (payload.status === "published" && !release.publishedAt) {
        updates.publishedAt = now;
      }
    }

    await db.update(releases).set(updates).where(eq(releases.id, releaseId));

    if (payload.items !== undefined) {
      await db.delete(releaseItems).where(eq(releaseItems.releaseId, releaseId));

      if (payload.items.length > 0) {
        const itemValues = payload.items.map((item, index) => ({
          id: uniqueId(),
          releaseId,
          kind: item.kind || "manual",
          title: item.title,
          description: item.description || null,
          prNumber: item.prNumber || null,
          prUrl: item.prUrl || null,
          prAuthor: item.prAuthor || null,
          sortOrder: item.sortOrder ?? index,
          createdAt: now,
        }));
        await db.insert(releaseItems).values(itemValues);
      }
    }

    const updated = await db.query.releases.findFirst({
      where: eq(releases.id, releaseId),
    });

    const items = await db
      .select()
      .from(releaseItems)
      .where(eq(releaseItems.releaseId, releaseId))
      .orderBy(asc(releaseItems.sortOrder));

    return c.json({ data: { ...updated!, items } }, 200);
  });
}
