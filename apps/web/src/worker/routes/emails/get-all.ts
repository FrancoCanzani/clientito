import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { emails } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  hasAnyEmailCategoryLabel,
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
      category,
      view = "inbox",
    } = c.req.valid("query");
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
      case "all":
        break;
    }

    if (view === "inbox") {
      if (category === "primary") {
        conditions.push(
          sql<boolean>`(${hasEmailLabel("CATEGORY_PERSONAL")} or not ${hasAnyEmailCategoryLabel()})`,
        );
      } else if (category === "promotions") {
        conditions.push(hasEmailLabel("CATEGORY_PROMOTIONS"));
      } else if (category === "social") {
        conditions.push(hasEmailLabel("CATEGORY_SOCIAL"));
      } else if (category === "notifications") {
        conditions.push(
          sql<boolean>`(${hasEmailLabel("CATEGORY_UPDATES")} or ${hasEmailLabel("CATEGORY_FORUMS")})`,
        );
      }
    }

    const whereClause = and(...conditions);

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
