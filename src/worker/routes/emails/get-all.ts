import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, isNull, like, lte, or, sql, gt } from "drizzle-orm";
import type { Hono } from "hono";
import { emails } from "../../db/schema";
import { catchUpMailboxOnDemand } from "../../lib/gmail/sync";
import type { AppRouteEnv } from "../types";
import {
  emailSummarySelection,
  hasEmailLabel,
  toEmailListResponse,
} from "./helpers";
import { listEmailsQuerySchema } from "./schemas";

export function registerGetAllEmails(api: Hono<AppRouteEnv>) {
  api.get("/", zValidator("query", listEmailsQuerySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const {
      limit = 50,
      offset = 0,
      search,
      isRead,
      view = "inbox",
    } = c.req.valid("query");

    const now = Date.now();

    // Wake up expired snoozes
    await db
      .update(emails)
      .set({ snoozedUntil: null })
      .where(
        and(
          eq(emails.userId, user.id),
          lte(emails.snoozedUntil, now),
        ),
      );

    if (offset === 0) {
      await catchUpMailboxOnDemand(db, c.env, user.id, user.email);
    }

    const conditions = [eq(emails.userId, user.id)];

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          like(emails.subject, pattern),
          like(emails.snippet, pattern),
          like(emails.fromAddr, pattern),
        )!,
      );
    }

    if (isRead === "true") conditions.push(eq(emails.isRead, true));
    else if (isRead === "false") conditions.push(eq(emails.isRead, false));

    switch (view) {
      case "inbox":
        conditions.push(hasEmailLabel("INBOX"));
        conditions.push(sql<boolean>`not ${hasEmailLabel("SENT")}`);
        // Hide snoozed emails from inbox
        conditions.push(
          or(isNull(emails.snoozedUntil), lte(emails.snoozedUntil, now))!,
        );
        break;
      case "sent":
        conditions.push(hasEmailLabel("SENT"));
        break;
      case "spam":
        conditions.push(hasEmailLabel("SPAM"));
        break;
      case "trash":
        conditions.push(hasEmailLabel("TRASH"));
        break;
      case "snoozed":
        conditions.push(gt(emails.snoozedUntil, now));
        break;
    }

    const whereClause = and(...conditions);

    const rowsWithExtra = await db
      .select(emailSummarySelection)
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
        pagination: {
          limit,
          offset,
          hasMore,
        },
      },
      200,
    );
  });
}
