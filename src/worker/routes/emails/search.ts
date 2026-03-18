import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { emails } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { hasEmailLabel, toEmailSearchResponse } from "./helpers";
import { searchEmailsQuerySchema } from "./schemas";

export function registerSearchEmails(api: Hono<AppRouteEnv>) {
  api.get("/search", zValidator("query", searchEmailsQuerySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { q, limit = 30 } = c.req.valid("query");
    const pattern = `%${q}%`;
    const rows = await db
      .select({
        id: emails.id,
        gmailId: emails.gmailId,
        fromAddr: emails.fromAddr,
        fromName: emails.fromName,
        toAddr: emails.toAddr,
        subject: emails.subject,
        snippet: emails.snippet,
        date: emails.date,
        isRead: emails.isRead,
        labelIds: emails.labelIds,
      })
      .from(emails)
      .where(
        and(
          eq(emails.userId, user.id),
          hasEmailLabel("INBOX"),
          sql<boolean>`not ${hasEmailLabel("SENT")}`,
          or(
            like(emails.fromAddr, pattern),
            like(emails.toAddr, pattern),
            like(emails.subject, pattern),
          ),
        ),
      )
      .orderBy(desc(emails.date))
      .limit(limit);
    return c.json({ data: rows.map(toEmailSearchResponse) }, 200);
  });
}
