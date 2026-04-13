import { zValidator } from "@hono/zod-validator";
import {
  and,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { emails } from "../../../db/schema";
import { isAutomatedSender } from "../../../lib/domains";
import type { AppRouteEnv } from "../../types";
import { HAS_ATTACHMENT_LABEL, hasEmailLabel } from "../emails/utils";
import { escapeLikePattern, parseSearchQuery, SEARCH_VIEW_VALUES } from "./utils";

const searchSuggestionsQuerySchema = z.object({
  q: z.string().trim().max(500).optional(),
  mailboxId: z.coerce.number().int().positive().optional(),
  view: z.enum(SEARCH_VIEW_VALUES).optional(),
});

function buildFilterSuggestions(query: string) {
  const formatOperatorValue = (value: string) =>
    /\s/.test(value) ? `"${value.replace(/"/g, "")}"` : value;

  if (!query) {
    return [
      {
        kind: "filter" as const,
        id: "filter-unread",
        label: "Unread",
        query: "is:unread",
        description: "Only unread messages",
      },
      {
        kind: "filter" as const,
        id: "filter-attachments",
        label: "Has attachment",
        query: "has:attachment",
        description: "Messages with files",
      },
      {
        kind: "filter" as const,
        id: "filter-sent",
        label: "Sent mail",
        query: "in:sent",
        description: "Search sent messages",
      },
      {
        kind: "filter" as const,
        id: "filter-important",
        label: "Important",
        query: "in:important",
        description: "Focus on priority mail",
      },
      {
        kind: "filter" as const,
        id: "filter-past-week",
        label: "Past week",
        query: "after:7d",
        description: "Messages from the last 7 days",
      },
      {
        kind: "filter" as const,
        id: "filter-past-month",
        label: "Past month",
        query: "after:30d",
        description: "Messages from the last 30 days",
      },
    ];
  }

  return [
    {
      kind: "filter" as const,
      id: `filter-from-${query}`,
      label: `From "${query}"`,
      query: `from:${formatOperatorValue(query)}`,
      description: "Search sender names and addresses",
    },
    {
      kind: "filter" as const,
      id: `filter-subject-${query}`,
      label: `Subject "${query}"`,
      query: `subject:${formatOperatorValue(query)}`,
      description: "Focus subject lines",
    },
    {
      kind: "filter" as const,
      id: `filter-unread-${query}`,
      label: `Unread "${query}"`,
      query: `is:unread ${query}`,
      description: "Unread results first",
    },
    {
      kind: "filter" as const,
      id: `filter-attachments-${query}`,
      label: `Attachments matching "${query}"`,
      query: `has:attachment ${query}`,
      description: "Messages with files attached",
    },
    {
      kind: "filter" as const,
      id: `filter-past-week-${query}`,
      label: `"${query}" from past week`,
      query: `after:7d ${query}`,
      description: "Recent results only",
    },
  ];
}

function buildViewConditions(
  view: (typeof SEARCH_VIEW_VALUES)[number] | undefined,
  now: number,
) {
  switch (view) {
    case "inbox":
      return [
        hasEmailLabel("INBOX"),
        or(isNull(emails.snoozedUntil), lte(emails.snoozedUntil, now))!,
      ];
    case "sent":
      return [hasEmailLabel("SENT")];
    case "spam":
      return [hasEmailLabel("SPAM")];
    case "trash":
      return [hasEmailLabel("TRASH")];
    case "snoozed":
      return [gt(emails.snoozedUntil, now)];
    case "archived":
      return [
        sql<boolean>`not ${hasEmailLabel("INBOX")}`,
        sql<boolean>`not ${hasEmailLabel("SENT")}`,
        sql<boolean>`not ${hasEmailLabel("TRASH")}`,
        sql<boolean>`not ${hasEmailLabel("SPAM")}`,
      ];
    case "starred":
      return [hasEmailLabel("STARRED")];
    case "important":
      return [hasEmailLabel("IMPORTANT")];
    default:
      return [];
  }
}

export function registerSearchSuggestions(api: Hono<AppRouteEnv>) {
  api.get(
    "/suggestions",
    zValidator("query", searchSuggestionsQuerySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { q = "", mailboxId, view } = c.req.valid("query");
      const parsedQuery = parseSearchQuery(q);
      const baseQuery = parsedQuery.plainText || q.trim();
      const normalizedQuery = baseQuery.toLowerCase().replace(/\s+/g, " ").trim();
      const escapedQuery = escapeLikePattern(normalizedQuery);
      const prefixPattern = `${escapedQuery}%`;
      const containsPattern = `%${escapedQuery}%`;
      const now = Date.now();
      const effectiveView = parsedQuery.view ?? view;

      const emailScopeConditions = [
        eq(emails.userId, user.id),
        ...buildViewConditions(effectiveView, now),
      ];

      if (!effectiveView) {
        emailScopeConditions.push(sql<boolean>`not ${hasEmailLabel("SPAM")}`);
        emailScopeConditions.push(sql<boolean>`not ${hasEmailLabel("TRASH")}`);
      }

      if (mailboxId) {
        emailScopeConditions.push(eq(emails.mailboxId, mailboxId));
      }

      if (parsedQuery.isRead !== undefined) {
        emailScopeConditions.push(eq(emails.isRead, parsedQuery.isRead));
      }

      if (parsedQuery.hasAttachment) {
        emailScopeConditions.push(hasEmailLabel(HAS_ATTACHMENT_LABEL));
      }

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
            ...emailScopeConditions,
            or(
              eq(emails.direction, "received"),
              and(
                eq(emails.direction, "sent"),
                isNotNull(emails.toAddr),
                sql`${emails.toAddr} not like '%,%'`,
              ),
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
            sql`${contactsBase.email} <> ${user.email.trim().toLowerCase()}`,
          ),
        )
        .groupBy(sql`${contactsBase.email}`)
        .as("grouped_contacts");

      const nameLower = sql`lower(coalesce(${groupedContacts.name}, ''))`;
      const emailLower = sql`lower(${groupedContacts.email})`;
      const contactWhere = normalizedQuery
        ? and(
            sql`(
              ${nameLower} like ${containsPattern} escape '\\'
              or ${emailLower} like ${containsPattern} escape '\\'
            )`,
          )
        : undefined;

      const contactRows = await db
        .select({
          email: groupedContacts.email,
          name: groupedContacts.name,
          lastInteractionAt: groupedContacts.lastInteractionAt,
          interactionCount: groupedContacts.interactionCount,
          sentCount: groupedContacts.sentCount,
          receivedCount: groupedContacts.receivedCount,
        })
        .from(groupedContacts)
        .where(contactWhere ?? sql`1 = 1`)
        .orderBy(
          ...(
            normalizedQuery
              ? [
                  sql<number>`case
                    when ${nameLower} like ${prefixPattern} escape '\\' then 0
                    when ${emailLower} like ${prefixPattern} escape '\\' then 1
                    when ${nameLower} like ${containsPattern} escape '\\' then 2
                    when ${emailLower} like ${containsPattern} escape '\\' then 3
                    else 4
                  end`,
                ]
              : []
          ),
          desc(groupedContacts.receivedCount),
          desc(groupedContacts.sentCount),
          desc(groupedContacts.lastInteractionAt),
        )
        .limit(8);

      const subjectConditions = [
        ...emailScopeConditions,
        sql`coalesce(${emails.subject}, '') <> ''`,
      ];

      if (normalizedQuery) {
        subjectConditions.push(
          sql`lower(coalesce(${emails.subject}, '')) like ${containsPattern} escape '\\'`,
        );
      }

      const subjectRows = await db
        .select({
          subject: emails.subject,
          lastUsedAt: sql<number | null>`max(${emails.date})`.as("last_used_at"),
        })
        .from(emails)
        .where(and(...subjectConditions))
        .groupBy(emails.subject)
        .orderBy(desc(sql`max(${emails.date})`))
        .limit(normalizedQuery ? 6 : 3);

      const data = {
        filters: buildFilterSuggestions(normalizedQuery),
        contacts: contactRows
          .filter((row) => !isAutomatedSender(row.email, row.name))
          .map((row) => ({
            kind: "contact" as const,
            id: `contact-${row.email}`,
            label: row.name || row.email,
            query: `from:${row.email}`,
            description: row.name ? row.email : null,
            email: row.email,
            name: row.name,
            avatarUrl: null,
            lastInteractionAt: row.lastInteractionAt,
            interactionCount: row.interactionCount,
          })),
        subjects: subjectRows
          .filter((row) => typeof row.subject === "string" && row.subject.trim())
          .map((row) => ({
            kind: "subject" as const,
            id: `subject-${row.subject}`,
            label: row.subject!,
            query: `subject:${/\s/.test(row.subject!) ? `"${row.subject!.replace(/"/g, "")}"` : row.subject!}`,
            subject: row.subject!,
            description: "Recent subject",
            lastUsedAt: row.lastUsedAt,
          })),
      };

      return c.json(data, 200);
    },
  );
}
