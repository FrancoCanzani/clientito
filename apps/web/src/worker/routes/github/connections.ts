import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { orgMembers, projects } from "../../db/schema";
import { unixNow } from "../../lib/slug";
import type { AppRouteEnv } from "../types";
import {
  createConnectionRequestSchema,
  getConnectionQuerySchema,
  githubConnectionSchema,
} from "./schemas";

const errorResponseSchema = z.object({ error: z.string() });

const createRoute_ = createRoute({
  method: "post",
  path: "/connections",
  tags: ["github"],
  summary: "Create GitHub connection",
  request: {
    body: {
      content: { "application/json": { schema: createConnectionRequestSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: z.object({ data: githubConnectionSchema }) } },
      description: "Connection created",
    },
    401: { content: { "application/json": { schema: errorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: errorResponseSchema } }, description: "Forbidden" },
    409: { content: { "application/json": { schema: errorResponseSchema } }, description: "Conflict" },
  },
});

const getRoute = createRoute({
  method: "get",
  path: "/connections",
  tags: ["github"],
  summary: "Get GitHub connection for project",
  request: { query: getConnectionQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ data: githubConnectionSchema.nullable() }) } },
      description: "Connection or null",
    },
    401: { content: { "application/json": { schema: errorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: errorResponseSchema } }, description: "Forbidden" },
  },
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/connections/:id",
  tags: ["github"],
  summary: "Delete GitHub connection",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
      description: "Deleted",
    },
    401: { content: { "application/json": { schema: errorResponseSchema } }, description: "Unauthorized" },
    404: { content: { "application/json": { schema: errorResponseSchema } }, description: "Not found" },
  },
});

async function checkProjectAccess(db: any, user: any, projectId: string) {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return null;
  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, project.orgId), eq(orgMembers.userId, user.id)),
  });
  return membership ? project : null;
}

function toGithubConnection(project: {
  id: string;
  githubRepoOwner: string | null;
  githubRepoName: string | null;
  githubConnectedByUserId: string | null;
  githubConnectedAt: number | null;
  updatedAt: number;
}) {
  if (!project.githubRepoOwner || !project.githubRepoName) {
    return null;
  }

  return {
    id: String(project.id),
    projectId: String(project.id),
    repoOwner: project.githubRepoOwner,
    repoName: project.githubRepoName,
    createdByUserId: project.githubConnectedByUserId ?? "",
    createdAt: project.githubConnectedAt ?? project.updatedAt,
  };
}

export function registerGithubConnections(api: OpenAPIHono<AppRouteEnv>) {
  api.openapi(createRoute_, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { projectId, repoOwner, repoName } = c.req.valid("json");

    const project = await checkProjectAccess(db, user, projectId);
    if (!project) return c.json({ error: "Forbidden" }, 403);

    if (project.githubRepoOwner && project.githubRepoName) {
      return c.json({ error: "Connection already exists for this project" }, 409);
    }

    const now = unixNow();

    await db.update(projects).set({
      githubRepoOwner: repoOwner.trim(),
      githubRepoName: repoName.trim(),
      githubConnectedByUserId: user.id,
      githubConnectedAt: now,
      updatedAt: now,
    }).where(eq(projects.id, projectId));

    const updated = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    return c.json({ data: toGithubConnection(updated!)! }, 201);
  });

  api.openapi(getRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { projectId } = c.req.valid("query");

    const project = await checkProjectAccess(db, user, projectId);
    if (!project) return c.json({ error: "Forbidden" }, 403);

    const connection = toGithubConnection(project);

    return c.json({ data: connection }, 200);
  });

  api.openapi(deleteRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { id } = c.req.valid("param");

    const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
    if (!project) return c.json({ error: "Not found" }, 404);

    const membership = await db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, project.orgId), eq(orgMembers.userId, user.id)),
    });
    if (!membership) return c.json({ error: "Forbidden" }, 403 as any);

    if (!project.githubRepoOwner || !project.githubRepoName) {
      return c.json({ error: "Not found" }, 404);
    }

    const now = unixNow();
    await db.update(projects).set({
      githubRepoOwner: null,
      githubRepoName: null,
      githubConnectedByUserId: null,
      githubConnectedAt: null,
      updatedAt: now,
    }).where(eq(projects.id, id));

    return c.json({ success: true }, 200);
  });
}
