import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { orgMembers, projects } from "../../db/schema";
import { toSlug, unixNow } from "../../lib/slug";
import type { AppRouteEnv } from "../types";
import {
  createProjectRequestSchema,
  createProjectResponseSchema,
} from "./schemas";

const errorResponseSchema = z.object({
  error: z.string(),
});

const route = createRoute({
  method: "post",
  path: "/",
  tags: ["projects"],
  summary: "Create project",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createProjectRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: createProjectResponseSchema,
        },
      },
      description: "Project created",
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

export function registerPostProject(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(route, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const payload = c.req.valid("json");
    const orgId = payload.orgId.trim();
    const name = payload.name.trim();

    const membership = await db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)),
    });

    if (!membership) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const requestedSlug = payload.slug?.trim() ? toSlug(payload.slug) : toSlug(name);
    const baseSlug = requestedSlug || "project";

    let slug = baseSlug;
    let suffix = 2;
    while (true) {
      const existing = await db.query.projects.findFirst({
        where: and(eq(projects.orgId, orgId), eq(projects.slug, slug)),
      });
      if (!existing) {
        break;
      }
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const now = unixNow();
    const inserted = await db
      .insert(projects)
      .values({
        orgId,
        name,
        slug,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: projects.id });
    const projectId = inserted[0]!.id;

    const created = (await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    })) ?? null;

    const data = created
      ? {
          ...created,
          id: String(created.id),
          orgId: String(created.orgId),
        }
      : null;

    return c.json({ data }, 201);
  });
}
