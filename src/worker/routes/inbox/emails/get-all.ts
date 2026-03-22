import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, isNull, lte, or, sql, gt, like } from "drizzle-orm";
import type { Hono } from "hono";
import { emails } from "../../../db/schema";
import { syncAllMailboxes } from "../../../lib/email/sync";
import { STANDARD_LABELS } from "../../../lib/email/types";
import type { AppRouteEnv } from "../../types";
import {
  emailSummarySelection,
  hasEmailLabel,
  toEmailListResponse,
} from "./utils";
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
      mailboxId,
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
      await syncAllMailboxes(db, c.env, user.id);
    }

    const conditions = [eq(emails.userId, user.id)];

    if (mailboxId) {
      conditions.push(eq(emails.mailboxId, mailboxId));
    }

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          like(emails.subject, pattern),
          like(emails.snippet, pattern),
          like(emails.fromAddr, pattern),
          like(emails.fromName, pattern),
          like(emails.toAddr, pattern),
          like(emails.bodyText, pattern),
        )!,
      );
    }

    if (isRead === "true") conditions.push(eq(emails.isRead, true));
    else if (isRead === "false") conditions.push(eq(emails.isRead, false));

    switch (view) {
      case "inbox":
        conditions.push(hasEmailLabel(STANDARD_LABELS.INBOX));
        // Hide snoozed emails from inbox
        conditions.push(
          or(isNull(emails.snoozedUntil), lte(emails.snoozedUntil, now))!,
        );
        break;
      case "sent":
        conditions.push(hasEmailLabel(STANDARD_LABELS.SENT));
        break;
      case "spam":
        conditions.push(hasEmailLabel(STANDARD_LABELS.SPAM));
        break;
      case "trash":
        conditions.push(hasEmailLabel(STANDARD_LABELS.TRASH));
        break;
      case "snoozed":
        conditions.push(gt(emails.snoozedUntil, now));
        break;
      case "archived":
        conditions.push(sql<boolean>`not ${hasEmailLabel(STANDARD_LABELS.INBOX)}`);
        conditions.push(sql<boolean>`not ${hasEmailLabel(STANDARD_LABELS.SENT)}`);
        conditions.push(sql<boolean>`not ${hasEmailLabel(STANDARD_LABELS.TRASH)}`);
        conditions.push(sql<boolean>`not ${hasEmailLabel(STANDARD_LABELS.SPAM)}`);
        break;
      case "starred":
        conditions.push(hasEmailLabel(STANDARD_LABELS.STARRED));
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
