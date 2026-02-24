import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, desc, eq } from "drizzle-orm";
import { orgMembers, projects, releases, releaseItems } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  getReleasesQuerySchema,
  getReleasesResponseSchema,
  getReleaseResponseSchema,
} from "./schemas";

const errorResponseSchema = z.object({ error: z.string() });

const listRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["releases"],
  summary: "List releases for a project",
  request: { query: getReleasesQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: getReleasesResponseSchema } },
      description: "List of releases",
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

const detailRoute = createRoute({
  method: "get",
  path: "/:releaseId",
  tags: ["releases"],
  summary: "Get release with items",
  request: {
    params: z.object({ releaseId: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: getReleaseResponseSchema } },
      description: "Release with items",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Not found",
    },
  },
});

export function registerGetReleases(api: OpenAPIHono<AppRouteEnv>) {
  api.openapi(listRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { projectId } = c.req.valid("query");

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) return c.json({ error: "Forbidden" }, 403);

    const membership = await db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, project.orgId), eq(orgMembers.userId, user.id)),
    });
    if (!membership) return c.json({ error: "Forbidden" }, 403);

    const data = await db
      .select()
      .from(releases)
      .where(eq(releases.projectId, projectId))
      .orderBy(desc(releases.createdAt));

    return c.json({ data }, 200);
  });

  api.openapi(detailRoute, async (c) => {
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

    const items = await db
      .select()
      .from(releaseItems)
      .where(eq(releaseItems.releaseId, releaseId))
      .orderBy(asc(releaseItems.sortOrder));

    return c.json({ data: { ...release, items } }, 200);
  });
}
