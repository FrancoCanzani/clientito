import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { orgMembers, organizations } from "../../db/schema";
import { toSlug, unixNow } from "../../lib/slug";
import type { AppRouteEnv } from "../types";
import {
  createOrganizationRequestSchema,
  createOrganizationResponseSchema,
} from "./schemas";

const errorResponseSchema = z.object({
  error: z.string(),
});

const route = createRoute({
  method: "post",
  path: "/",
  tags: ["organizations"],
  summary: "Create organization",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createOrganizationRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: createOrganizationResponseSchema,
        },
      },
      description: "Organization created",
    },
    401: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Unauthorized",
    },
  },
});

export function registerPostOrganization(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(route, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const payload = c.req.valid("json");
    const name = payload.name.trim();

    const requestedSlug = payload.slug?.trim() ? toSlug(payload.slug) : toSlug(name);
    const baseSlug = requestedSlug || "org";

    let slug = baseSlug;
    let suffix = 2;
    while (true) {
      const existing = await db.query.organizations.findFirst({
        where: eq(organizations.slug, slug),
      });
      if (!existing) {
        break;
      }
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const now = unixNow();
    const inserted = await db
      .insert(organizations)
      .values({
        name,
        slug,
        createdByUserId: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: organizations.id });
    const orgId = inserted[0]!.id;

    await db.insert(orgMembers).values({
      orgId,
      userId: user.id,
      role: "owner",
      createdAt: now,
    });

    const created = (await db.query.organizations.findFirst({
      where: and(eq(organizations.id, orgId), eq(organizations.createdByUserId, user.id)),
    })) ?? null;
    const data = created
      ? {
          ...created,
          id: String(created.id),
        }
      : null;

    return c.json({ data }, 201);
  });
}
