import { zValidator } from "@hono/zod-validator";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { emailIntelligence, emails } from "../../../db/schema";
import { STANDARD_LABELS } from "../../../lib/gmail/types";
import type { AppRouteEnv } from "../../types";
import {
  HAS_ATTACHMENT_LABEL,
  CATEGORY_VIEWS,
  emailIntelligenceSelection,
  emailSummarySelection,
  hasEmailLabel,
  toEmailListResponse,
} from "../emails/utils";
import { escapeLikePattern, parseSearchQuery, SEARCH_VIEW_VALUES } from "./utils";

const emailSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  includeJunk: z.coerce.boolean().optional(),
  mailboxId: z.coerce.number().int().positive().optional(),
  view: z.enum(SEARCH_VIEW_VALUES).optional(),
});

export function registerEmailSearch(api: Hono<AppRouteEnv>) {
  api.get(
    "/emails",
    zValidator("query", emailSearchQuerySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const {
        q,
        limit = 30,
        offset = 0,
        includeJunk = false,
        mailboxId,
        view,
      } = c.req.valid("query");
      const parsedQuery = parseSearchQuery(q);
      const effectiveView = parsedQuery.view ?? view;
      const now = Date.now();

      const conditions = [eq(emails.userId, user.id)];

      if (mailboxId) {
        conditions.push(eq(emails.mailboxId, mailboxId));
      }

      if (parsedQuery.isRead !== undefined) {
        conditions.push(eq(emails.isRead, parsedQuery.isRead));
      }

      if (parsedQuery.hasAttachment) {
        conditions.push(hasEmailLabel(HAS_ATTACHMENT_LABEL));
      }

      if (parsedQuery.before !== undefined) {
        conditions.push(lte(emails.date, parsedQuery.before));
      }

      if (parsedQuery.after !== undefined) {
        conditions.push(
          sql`${emails.date} >= ${parsedQuery.after}`,
        );
      }

      for (const value of parsedQuery.from) {
        const pattern = `%${escapeLikePattern(value.toLowerCase())}%`;
        conditions.push(
          or(
            sql`lower(coalesce(${emails.fromAddr}, '')) like ${pattern} escape '\\'`,
            sql`lower(coalesce(${emails.fromName}, '')) like ${pattern} escape '\\'`,
          )!,
        );
      }

      for (const value of parsedQuery.to) {
        const pattern = `%${escapeLikePattern(value.toLowerCase())}%`;
        conditions.push(
          sql`lower(coalesce(${emails.toAddr}, '')) like ${pattern} escape '\\'`,
        );
      }

      for (const value of parsedQuery.subject) {
        const pattern = `%${escapeLikePattern(value.toLowerCase())}%`;
        conditions.push(
          sql`lower(coalesce(${emails.subject}, '')) like ${pattern} escape '\\'`,
        );
      }

      const plainTerms = parsedQuery.plainText
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean)
        .slice(0, 6);

      for (const term of plainTerms) {
        const pattern = `%${escapeLikePattern(term.toLowerCase())}%`;
        conditions.push(
          or(
            sql`lower(coalesce(${emails.subject}, '')) like ${pattern} escape '\\'`,
            sql`lower(coalesce(${emails.snippet}, '')) like ${pattern} escape '\\'`,
            sql`lower(coalesce(${emails.fromAddr}, '')) like ${pattern} escape '\\'`,
            sql`lower(coalesce(${emails.fromName}, '')) like ${pattern} escape '\\'`,
            sql`lower(coalesce(${emails.toAddr}, '')) like ${pattern} escape '\\'`,
            sql`lower(coalesce(${emails.bodyText}, '')) like ${pattern} escape '\\'`,
          )!,
        );
      }

      const baseConditions = [...conditions];

      if (effectiveView && CATEGORY_VIEWS.has(effectiveView)) {
        conditions.push(
          sql<boolean>`${emailIntelligence.category} = ${effectiveView}`,
        );
      } else {
        switch (effectiveView) {
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
            conditions.push(
              sql<boolean>`${emailIntelligence.category} in ('to_respond', 'to_follow_up')`,
            );
            break;
          default:
            if (!includeJunk) {
              conditions.push(sql<boolean>`not ${hasEmailLabel(STANDARD_LABELS.SPAM)}`);
              conditions.push(sql<boolean>`not ${hasEmailLabel(STANDARD_LABELS.TRASH)}`);
            }
            break;
        }
      }

      const normalizedPlainText = parsedQuery.plainText.toLowerCase();
      const escapedPlainText = escapeLikePattern(normalizedPlainText);
      const prefixPattern = `${escapedPlainText}%`;
      const containsPattern = `%${escapedPlainText}%`;
      const relevance = normalizedPlainText
        ? sql<number>`case
            when lower(coalesce(${emails.subject}, '')) like ${prefixPattern} escape '\\' then 0
            when lower(coalesce(${emails.fromName}, '')) like ${prefixPattern} escape '\\' then 1
            when lower(coalesce(${emails.fromAddr}, '')) like ${prefixPattern} escape '\\' then 2
            when lower(coalesce(${emails.subject}, '')) like ${containsPattern} escape '\\' then 3
            when lower(coalesce(${emails.snippet}, '')) like ${containsPattern} escape '\\' then 4
            when lower(coalesce(${emails.bodyText}, '')) like ${containsPattern} escape '\\' then 5
            else 6
          end`
        : sql<number>`0`;

      const rowsWithExtra = await db
        .select({
          ...emailSummarySelection,
          ...emailIntelligenceSelection,
          relevance,
        })
        .from(emails)
        .leftJoin(emailIntelligence, eq(emailIntelligence.emailId, emails.id))
        .where(and(...conditions))
        .orderBy(
          ...(normalizedPlainText ? [relevance] : []),
          asc(emails.isRead),
          desc(emails.date),
        )
        .limit(limit + 1)
        .offset(offset);

      const hasMore = rowsWithExtra.length > limit;
      const rows = hasMore ? rowsWithExtra.slice(0, limit) : rowsWithExtra;
      let hiddenJunkCount = 0;

      if (!includeJunk && !effectiveView) {
        const hiddenJunkRows = await db
          .select({ count: sql<number>`count(*)` })
          .from(emails)
          .leftJoin(emailIntelligence, eq(emailIntelligence.emailId, emails.id))
          .where(
            and(
              ...baseConditions,
              or(
                hasEmailLabel(STANDARD_LABELS.SPAM),
                hasEmailLabel(STANDARD_LABELS.TRASH),
              )!,
            ),
          );

        hiddenJunkCount = hiddenJunkRows[0]?.count ?? 0;
      }

      return c.json(
        {
          data: rows.map((row) => toEmailListResponse(row)),
          pagination: {
            limit,
            offset,
            hasMore,
          },
          searchMeta: {
            hiddenJunkCount,
          },
        },
        200,
      );
    },
  );
}
