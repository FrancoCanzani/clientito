import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, gt, isNull, like, lte, or, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { emails, mailboxes } from "../../../db/schema";
import { catchUpAllMailboxes } from "../../../lib/gmail/sync/engine";
import { STANDARD_LABELS } from "../../../lib/gmail/types";
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
      limit = 100,
      offset = 0,
      search,
      isRead,
      view = "inbox",
      mailboxId,
      includeBody = false,
    } = c.req.valid("query");

    const now = Date.now();

    await db
      .update(emails)
      .set({ snoozedUntil: null })
      .where(
        and(
          eq(emails.userId, user.id),
          lte(emails.snoozedUntil, now),
        ),
      );

    const shouldAttemptBackgroundSync =
      offset === 0 &&
      view === "inbox" &&
      !search &&
      isRead === undefined;

    if (shouldAttemptBackgroundSync) {
      const mailboxSyncRows = mailboxId
        ? await db
            .select({
              lastSuccessfulSyncAt: mailboxes.lastSuccessfulSyncAt,
            })
            .from(mailboxes)
            .where(and(eq(mailboxes.userId, user.id), eq(mailboxes.id, mailboxId)))
            .limit(1)
        : await db
            .select({
              lastSuccessfulSyncAt: sql<number | null>`max(${mailboxes.lastSuccessfulSyncAt})`,
            })
            .from(mailboxes)
            .where(eq(mailboxes.userId, user.id))
            .limit(1);

      const lastSuccessfulSyncAt = mailboxSyncRows[0]?.lastSuccessfulSyncAt ?? null;
      const syncThrottleMs = 60_000;
      const isSyncStale =
        typeof lastSuccessfulSyncAt !== "number" ||
        now - lastSuccessfulSyncAt > syncThrottleMs;

      if (isSyncStale) {
        c.executionCtx.waitUntil(
          catchUpAllMailboxes(db, c.env, user.id).catch((err) => {
            console.error("Background sync failed (email list)", err);
          }),
        );
      }
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

    if (view) {
      switch (view) {
        case "all":
          break;
        case "inbox":
          conditions.push(hasEmailLabel(STANDARD_LABELS.INBOX));
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
        case "important":
          conditions.push(hasEmailLabel(STANDARD_LABELS.IMPORTANT));
          break;
        default:
          if (view.startsWith("Label_")) {
            conditions.push(hasEmailLabel(view));
          }
          break;
      }
    }

    const whereClause = and(...conditions);

    const rowsWithExtra = await db
      .select({
        ...emailSummarySelection,
        bodyText: emails.bodyText,
        bodyHtml: emails.bodyHtml,
      })
      .from(emails)
      .where(whereClause)
      .orderBy(desc(emails.date))
      .limit(limit + 1)
      .offset(offset);
    const hasMore = rowsWithExtra.length > limit;
    const rows = hasMore ? rowsWithExtra.slice(0, limit) : rowsWithExtra;

    return c.json(
      {
        data: rows.map((row) => {
          const item = toEmailListResponse(row);
          if (!includeBody) {
            return item;
          }

          return {
            ...item,
            bodyText: row.bodyText ?? null,
            bodyHtml: row.bodyHtml ?? null,
          };
        }),
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
