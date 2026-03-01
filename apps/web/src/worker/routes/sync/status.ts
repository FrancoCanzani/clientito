import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq, sql } from "drizzle-orm";
import { account } from "../../db/auth-schema";
import { contacts, customers, syncState } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import { GOOGLE_RECONNECT_REQUIRED_MESSAGE } from "../../lib/gmail";
import type { AppRouteEnv } from "../types";
import {
  errorResponseSchema,
  syncStatusQuerySchema,
  syncStatusResponseSchema,
} from "./schemas";

const syncStatusRoute = createRoute({
  method: "get",
  path: "/status",
  tags: ["sync"],
  request: {
    query: syncStatusQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: syncStatusResponseSchema,
        },
      },
      description: "Sync status",
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

export function registerGetSyncStatus(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(syncStatusRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { orgId } = c.req.valid("query");
    if (!(await ensureOrgAccess(db, orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const state = await db.query.syncState.findFirst({
      where: eq(syncState.orgId, orgId),
    });
    const googleAccount = await db.query.account.findFirst({
      where: and(
        eq(account.userId, user.id),
        eq(account.providerId, "google"),
      ),
      columns: {
        refreshToken: true,
      },
    });

    const hasSynced = Boolean(state?.historyId);
    const needsGoogleReconnect =
      !googleAccount?.refreshToken ||
      state?.error === GOOGLE_RECONNECT_REQUIRED_MESSAGE;

    // Count contacts that have no matching customer
    let needsContactReview = false;
    if (hasSynced) {
      const userEmail = user.email?.trim().toLowerCase() ?? null;
      const ownEmailCondition = userEmail
        ? sql`trim(replace(replace(lower(${contacts.email}), '<', ''), '>', '')) != ${userEmail}`
        : sql`1 = 1`;
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .leftJoin(
          customers,
          and(
            eq(customers.orgId, contacts.orgId),
            eq(customers.email, contacts.email),
          ),
        )
        .where(
          and(
            eq(contacts.orgId, orgId),
            ownEmailCondition,
            sql`${customers.id} is null`,
          ),
        );
      needsContactReview = (Number(result[0]?.count) ?? 0) > 0;
    }

    return c.json(
      {
        data: {
          hasSynced,
          historyId: state?.historyId ?? null,
          lastSync: state?.lastSync ?? null,
          phase: state?.phase ?? null,
          progressCurrent: state?.progressCurrent ?? null,
          progressTotal: state?.progressTotal ?? null,
          error: state?.error ?? null,
          needsGoogleReconnect,
          needsContactReview,
        },
      },
      200,
    );
  });
}
