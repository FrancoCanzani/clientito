import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, eq } from "drizzle-orm";
import { orgMembers, projects } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { getProjectsQuerySchema, getProjectsResponseSchema } from "./schemas";

const errorResponseSchema = z.object({
  error: z.string(),
});

const route = createRoute({
  method: "get",
  path: "/",
  tags: ["projects"],
  summary: "List projects for organization",
  request: {
    query: getProjectsQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: getProjectsResponseSchema,
        },
      },
      description: "List of projects",
    },
    401: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Unauthorized",
    },
    403: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Forbidden",
    },
  },
});

export function registerGetProjects(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(route, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { orgId } = c.req.valid("query");

    const membership = await db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)),
    });

    if (!membership) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const data = await db
      .select({
        id: projects.id,
        orgId: projects.orgId,
        name: projects.name,
        slug: projects.slug,
        githubRepoOwner: projects.githubRepoOwner,
        githubRepoName: projects.githubRepoName,
        githubConnectedByUserId: projects.githubConnectedByUserId,
        githubConnectedAt: projects.githubConnectedAt,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(eq(projects.orgId, orgId))
      .orderBy(asc(projects.name));

    return c.json(
      {
        data: data.map((project) => ({
          ...project,
          id: String(project.id),
          orgId: String(project.orgId),
        })),
      },
      200
    );
  });
}
