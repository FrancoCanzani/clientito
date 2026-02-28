import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ensureOrgAccess } from "../../lib/access";
import type { AppRouteEnv } from "../types";
import {
  errorResponseSchema,
  syncAcceptedResponseSchema,
  syncRequestSchema,
} from "./schemas";
import {
  isSyncInProgress,
  runFullSyncInBackground,
} from "./service";

const startSyncRoute = createRoute({
  method: "post",
  path: "/start",
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
    403: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Forbidden",
    },
    409: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Conflict",
    },
  },
});

export function registerPostSyncStart(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(startSyncRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { orgId, months, continueFullSync } = c.req.valid("json");
    if (!(await ensureOrgAccess(db, orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    if (await isSyncInProgress(db, orgId)) {
      return c.json({ error: "Sync already in progress" }, 409);
    }

    c.executionCtx.waitUntil(
      runFullSyncInBackground(db, c.env, orgId, user.id, months, continueFullSync),
    );
    return c.json({ data: { status: "started" } }, 202);
  });
}
