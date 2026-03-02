import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, asc, eq } from "drizzle-orm";
import { emails } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  emailThreadParamsSchema,
  emailThreadResponseSchema,
  errorResponseSchema,
} from "./schemas";
import { toEmailListResponse } from "./utils";

const getEmailThreadRoute = createRoute({
  method: "get",
  path: "/thread/:threadId",
  tags: ["emails"],
  request: {
    params: emailThreadParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: emailThreadResponseSchema,
        },
      },
      description: "Thread emails",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

export function registerGetEmailThread(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(getEmailThreadRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { threadId } = c.req.valid("param");

    const rows = await db
      .select({
        id: emails.id,
        gmailId: emails.gmailId,
        fromAddr: emails.fromAddr,
        fromName: emails.fromName,
        toAddr: emails.toAddr,
        subject: emails.subject,
        snippet: emails.snippet,
        bodyText: emails.bodyText,
        bodyHtml: emails.bodyHtml,
        threadId: emails.threadId,
        date: emails.date,
        direction: emails.direction,
        isRead: emails.isRead,
        labelIds: emails.labelIds,
        personId: emails.personId,
        createdAt: emails.createdAt,
      })
      .from(emails)
      .where(and(eq(emails.threadId, threadId), eq(emails.userId, user.id)))
      .orderBy(asc(emails.date));

    return c.json({ data: rows.map(toEmailListResponse) }, 200);
  });
}
