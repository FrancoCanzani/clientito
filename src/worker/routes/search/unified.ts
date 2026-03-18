import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, isNotNull, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { emails } from "../../db/schema";
import { isAutomatedSender } from "../../lib/domains";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";

const unifiedSearchQuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

const contactAutocompleteQuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, "\\$&");
}

const searchRoutes = new Hono<AppRouteEnv>();

searchRoutes.use("*", requireAuth);

searchRoutes.get(
  "/contacts",
  zValidator("query", contactAutocompleteQuerySchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const { q, limit = 8 } = c.req.valid("query");

    const normalizedQuery = q.toLowerCase().replace(/\s+/g, " ").trim();
    const escapedQuery = escapeLikePattern(normalizedQuery);
    const prefixPattern = `${escapedQuery}%`;
    const containsPattern = `%${escapedQuery}%`;
    const searchTerms = normalizedQuery.split(" ").filter(Boolean).slice(0, 5);
    const normalizedUserEmail = user.email.trim().toLowerCase();

    const contactsBase = db
      .select({
        email: sql<string>`lower(
          case
            when ${emails.direction} = 'received' then ${emails.fromAddr}
            else coalesce(${emails.toAddr}, '')
          end
        )`.as("email"),
        name: sql<string | null>`case
          when ${emails.direction} = 'received'
            then nullif(trim(coalesce(${emails.fromName}, '')), '')
          else null
        end`.as("name"),
        date: emails.date,
        sentCount: sql<number>`case when ${emails.direction} = 'sent' then 1 else 0 end`.as(
          "sent_count",
        ),
        receivedCount: sql<number>`case when ${emails.direction} = 'received' then 1 else 0 end`.as(
          "received_count",
        ),
      })
      .from(emails)
      .where(
        and(
          eq(emails.userId, user.id),
          or(
            eq(emails.direction, "received"),
            and(eq(emails.direction, "sent"), isNotNull(emails.toAddr)),
          ),
        ),
      )
      .as("contacts_base");

    const groupedContacts = db
      .select({
        email: contactsBase.email,
        name: sql<string | null>`max(${contactsBase.name})`.as("name"),
        lastInteractionAt: sql<number | null>`max(${contactsBase.date})`.as(
          "last_interaction_at",
        ),
        interactionCount: sql<number>`count(*)`.as("interaction_count"),
        sentCount: sql<number>`sum(${contactsBase.sentCount})`.as("sent_count"),
        receivedCount: sql<number>`sum(${contactsBase.receivedCount})`.as(
          "received_count",
        ),
      })
      .from(contactsBase)
      .where(
        and(
          sql`${contactsBase.email} <> ''`,
          sql`${contactsBase.email} <> ${normalizedUserEmail}`,
        ),
      )
      .groupBy(sql`${contactsBase.email}`)
      .as("grouped_contacts");

    const emailLower = sql`lower(${groupedContacts.email})`;
    const nameLower = sql`lower(coalesce(${groupedContacts.name}, ''))`;
    const searchFilters = searchTerms.map((term) => {
      const termPattern = `%${escapeLikePattern(term)}%`;
      return sql`(
        ${nameLower} like ${termPattern} escape '\\'
        or ${emailLower} like ${termPattern} escape '\\'
      )`;
    });
    const relevance = sql<number>`case
      when ${nameLower} like ${prefixPattern} escape '\\' then 0
      when ${emailLower} like ${prefixPattern} escape '\\' then 1
      when ${nameLower} like ${containsPattern} escape '\\' then 2
      when ${emailLower} like ${containsPattern} escape '\\' then 3
      else 4
    end`;

    const rows = await db
      .select({
        email: groupedContacts.email,
        name: groupedContacts.name,
        lastInteractionAt: groupedContacts.lastInteractionAt,
        interactionCount: groupedContacts.interactionCount,
        sentCount: groupedContacts.sentCount,
        receivedCount: groupedContacts.receivedCount,
      })
      .from(groupedContacts)
      .where(and(...searchFilters))
      .orderBy(
        relevance,
        desc(groupedContacts.receivedCount),
        desc(groupedContacts.sentCount),
        desc(groupedContacts.lastInteractionAt),
        desc(groupedContacts.interactionCount),
      )
      .limit(limit * 6);

    const suggestions = rows
      .filter((row) => !isAutomatedSender(row.email, row.name))
      .slice(0, limit)
      .map((row) => ({
        email: row.email,
        name: row.name,
        avatarUrl: null,
        lastInteractionAt: row.lastInteractionAt,
        interactionCount: row.interactionCount,
      }));

    return c.json({ data: suggestions }, 200);
  },
);

searchRoutes.get(
  "/",
  zValidator("query", unifiedSearchQuerySchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { q, limit = 10 } = c.req.valid("query");
    const pattern = `%${q}%`;
    const emailRows = await db
        .select({
          id: emails.id,
          fromAddr: emails.fromAddr,
          fromName: emails.fromName,
          subject: emails.subject,
          snippet: emails.snippet,
          date: emails.date,
        })
        .from(emails)
        .where(
          and(
            eq(emails.userId, user.id),
            or(
              like(emails.fromAddr, pattern),
              like(emails.subject, pattern),
              like(emails.snippet, pattern),
            ),
          ),
        )
        .orderBy(desc(emails.date))
        .limit(limit);

    return c.json(
      {
        emails: emailRows.map((row) => ({
          id: String(row.id),
          fromAddr: row.fromAddr,
          fromName: row.fromName,
          subject: row.subject,
          snippet: row.snippet,
          date: row.date,
        })),
      },
      200,
    );
  },
);

export default searchRoutes;
