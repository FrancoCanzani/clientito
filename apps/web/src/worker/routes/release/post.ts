import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, eq } from "drizzle-orm";
import { orgMembers, projects, releases, releaseItems } from "../../db/schema";
import { toSlug, unixNow, uniqueId } from "../../lib/slug";
import type { AppRouteEnv } from "../types";
import { createReleaseRequestSchema, createReleaseResponseSchema } from "./schemas";

const errorResponseSchema = z.object({ error: z.string() });

const route = createRoute({
  method: "post",
  path: "/",
  tags: ["releases"],
  summary: "Create release",
  request: {
    body: {
      content: { "application/json": { schema: createReleaseRequestSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: createReleaseResponseSchema } },
      description: "Release created",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
    403: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Forbidden",
    },
  },
});

export function registerPostRelease(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(route, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const payload = c.req.valid("json");
    const projectId = payload.projectId.trim();
    const title = payload.title.trim();

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) return c.json({ error: "Forbidden" }, 403);

    const membership = await db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, project.orgId), eq(orgMembers.userId, user.id)),
    });
    if (!membership) return c.json({ error: "Forbidden" }, 403);

    const requestedSlug = payload.slug?.trim() ? toSlug(payload.slug) : toSlug(title);
    const baseSlug = requestedSlug || "release";

    let slug = baseSlug;
    let suffix = 2;
    while (true) {
      const existing = await db.query.releases.findFirst({
        where: and(eq(releases.projectId, projectId), eq(releases.slug, slug)),
      });
      if (!existing) break;
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const now = unixNow();
    const releaseId = uniqueId();

    await db.insert(releases).values({
      id: releaseId,
      projectId,
      title,
      slug,
      version: payload.version?.trim() || null,
      notes: payload.notes || null,
      status: "draft",
      publishedAt: null,
      createdByUserId: user.id,
      createdAt: now,
      updatedAt: now,
    });

    if (payload.items?.length) {
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

    const created = await db.query.releases.findFirst({
      where: eq(releases.id, releaseId),
    });

    const items = await db
      .select()
      .from(releaseItems)
      .where(eq(releaseItems.releaseId, releaseId))
      .orderBy(asc(releaseItems.sortOrder));

    return c.json({ data: created ? { ...created, items } : null }, 201);
  });
}
