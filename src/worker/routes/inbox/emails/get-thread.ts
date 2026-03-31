import { zValidator } from "@hono/zod-validator";
import { and, asc, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { emailIntelligence, emails } from "../../../db/schema";
import { syncAllMailboxes } from "../../../lib/email/sync";
import type { AppRouteEnv } from "../../types";
import {
  emailIntelligenceSelection,
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
      await syncAllMailboxes(db, c.env, user.id);

      const rows = await db
        .select({
          ...emailSummarySelection,
          ...emailIntelligenceSelection,
        })
        .from(emails)
        .leftJoin(emailIntelligence, eq(emailIntelligence.emailId, emails.id))
        .where(and(eq(emails.threadId, threadId), eq(emails.userId, user.id)))
        .orderBy(asc(emails.date));

      return c.json({ data: rows.map(toEmailListResponse) }, 200);
    },
  );
}
