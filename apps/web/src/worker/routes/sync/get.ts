import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { account } from "../../db/auth-schema";
import { syncState } from "../../db/schema";
import { GOOGLE_RECONNECT_REQUIRED_MESSAGE } from "../../lib/gmail/errors";
import type { AppRouteEnv } from "../types";
import { errorResponseSchema, syncStatusResponseSchema } from "./schemas";

const syncStatusRoute = createRoute({
  method: "get",
  path: "/status",
  tags: ["sync"],
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
  },
});

export function registerGetSync(api: OpenAPIHono<AppRouteEnv>) {
  api.openapi(syncStatusRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const state = await db.query.syncState.findFirst({
      where: eq(syncState.userId, user.id),
    });
    const now = Date.now();
    const hasLiveLock =
      typeof state?.lockUntil === "number" &&
      Number.isFinite(state.lockUntil) &&
      state.lockUntil > now;
    const isStaleInProgressState =
      Boolean(state?.phase) && state?.phase !== "error" && !hasLiveLock;

    if (isStaleInProgressState) {
      await db
        .update(syncState)
        .set({
          phase: null,
          progressCurrent: null,
          progressTotal: null,
          lockUntil: null,
        })
        .where(eq(syncState.userId, user.id));
    }

    const effectivePhase = isStaleInProgressState ? null : (state?.phase ?? null);
    const effectiveProgressCurrent = isStaleInProgressState
      ? null
      : (state?.progressCurrent ?? null);
    const effectiveProgressTotal = isStaleInProgressState
      ? null
      : (state?.progressTotal ?? null);

    const googleAccount = await db.query.account.findFirst({
      where: and(eq(account.userId, user.id), eq(account.providerId, "google")),
      columns: { refreshToken: true },
    });

    const hasSynced = Boolean(state?.historyId);
    const needsGoogleReconnect =
      !googleAccount?.refreshToken ||
      state?.error === GOOGLE_RECONNECT_REQUIRED_MESSAGE;

    return c.json(
      {
        data: {
          hasSynced,
          historyId: state?.historyId ?? null,
          lastSync: state?.lastSync ?? null,
          phase: effectivePhase,
          progressCurrent: effectiveProgressCurrent,
          progressTotal: effectiveProgressTotal,
          error: state?.error ?? null,
          needsGoogleReconnect,
          needsContactReview: false,
        },
      },
      200,
    );
  });
}
