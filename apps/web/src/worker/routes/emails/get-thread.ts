import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { emails } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { emailSummarySelection, toEmailListResponse } from "./helpers";
import { emailThreadParamsSchema } from "./schemas";

export function registerGetEmailThread(api: Hono<AppRouteEnv>) {
  api.get(
    "/thread/:threadId",
    zValidator("param", emailThreadParamsSchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;

      const { threadId } = c.req.valid("param");
      const rows = await db
        .select(emailSummarySelection)
        .from(emails)
        .where(and(eq(emails.threadId, threadId), eq(emails.userId, user.id)))
        .orderBy(asc(emails.date));

      return c.json({ data: rows.map(toEmailListResponse) }, 200);
    },
  );
}
