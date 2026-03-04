import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { emails } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { toEmailListResponse } from "./helpers";
import { emailPersonParamsSchema, emailPersonQuerySchema } from "./schemas";

export function registerGetPersonEmails(api: Hono<AppRouteEnv>) {
  api.get(
    "/person/:personId",
    zValidator("param", emailPersonParamsSchema),
    zValidator("query", emailPersonQuerySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;

      const { personId } = c.req.valid("param");
      const { limit = 50, offset = 0 } = c.req.valid("query");

      const whereClause = and(
        eq(emails.personId, personId),
        eq(emails.userId, user.id),
      );

      const rowsWithExtra = await db
        .select()
        .from(emails)
        .where(whereClause)
        .orderBy(desc(emails.date))
        .limit(limit + 1)
        .offset(offset);
      const hasMore = rowsWithExtra.length > limit;
      const rows = hasMore ? rowsWithExtra.slice(0, limit) : rowsWithExtra;
      return c.json(
        {
          data: rows.map(toEmailListResponse),
          pagination: { limit, offset, hasMore },
        },
        200,
      );
    },
  );
}
