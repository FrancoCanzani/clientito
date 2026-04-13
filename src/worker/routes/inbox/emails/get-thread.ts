import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { emails } from "../../../db/schema";
import { catchUpAllMailboxes } from "../../../lib/gmail/sync/engine";
import type { AppRouteEnv } from "../../types";
import {
  emailSummarySelection,
  toEmailListResponse,
} from "./utils";
import { emailThreadParamsSchema } from "./schemas";

export function registerGetEmailThread(api: Hono<AppRouteEnv>) {
  api.get(
    "/thread/:threadId",
    zValidator("param", emailThreadParamsSchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;

      const { threadId } = c.req.valid("param");
      c.executionCtx.waitUntil(
        catchUpAllMailboxes(db, c.env, user.id).catch((err) => {
          console.error("Background sync failed (thread)", err);
        }),
      );

      const rows = await db
        .select({
          ...emailSummarySelection,
          bodyText: emails.bodyText,
          bodyHtml: emails.bodyHtml,
        })
        .from(emails)
        .where(and(eq(emails.threadId, threadId), eq(emails.userId, user.id)))
        .orderBy(asc(emails.date));

      return c.json(
        rows.map((row) => ({
          ...toEmailListResponse(row),
          bodyText: row.bodyText,
          bodyHtml: row.bodyHtml,
        })),
        200,
      );
    },
  );
}
