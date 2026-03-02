import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { AppRouteEnv } from "../types";
import {
  errorResponseSchema,
  syncAcceptedResponseSchema,
  syncRequestSchema,
} from "./schemas";
import { isSyncInProgress, runIncrementalSyncInBackground } from "./service";

const incrementalSyncRoute = createRoute({
  method: "post",
  path: "/incremental",
  tags: ["sync"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: syncRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    202: {
      content: {
        "application/json": {
          schema: syncAcceptedResponseSchema,
        },
      },
      description: "Sync started",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
    409: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Conflict",
    },
  },
});

export function registerPostSyncIncremental(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(incrementalSyncRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    c.req.valid("json");

    if (await isSyncInProgress(db, user.id)) {
      return c.json({ error: "Sync already in progress" }, 409);
    }

    c.executionCtx.waitUntil(
      runIncrementalSyncInBackground(db, c.env, user.id),
    );
    return c.json({ data: { status: "started" } }, 202);
  });
}
