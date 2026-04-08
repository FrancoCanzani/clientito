import { tool } from "ai";
import { and, asc, desc, eq, gt, isNotNull, isNull, like, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db/client";
import { emailIntelligence, emails, type EmailAction } from "../../db/schema";
import {
  getStoredEmailClassification,
} from "../../lib/gmail/intelligence/store";
import { catchUpAllMailboxes } from "../../lib/gmail/sync/engine";
import { STANDARD_LABELS } from "../../lib/gmail/types";
import { hasEmailLabel } from "../../routes/inbox/emails/utils";

type InboxView =
  | "inbox"
  | "sent"
  | "spam"
  | "trash"
  | "snoozed"
  | "archived"
  | "starred";

function parseInboxScope(currentUrl?: string | null): {
  mailboxId?: number;
  view: InboxView;
} {
  const fallback = { view: "inbox" as InboxView };
  if (!currentUrl) return fallback;

  try {
    const url = new URL(currentUrl);
    const match = url.pathname.match(/\/inbox\/([^/?#]+)/);
    const mailboxValue = match?.[1];
    const maybeView = url.searchParams.get("view");
    const view: InboxView =
      maybeView === "sent" ||
      maybeView === "spam" ||
      maybeView === "trash" ||
      maybeView === "snoozed" ||
      maybeView === "archived" ||
      maybeView === "starred"
        ? maybeView
        : "inbox";

    return {
      mailboxId:
        mailboxValue && mailboxValue !== "all" && /^\d+$/.test(mailboxValue)
          ? Number(mailboxValue)
          : undefined,
      view,
    };
  } catch {
    return fallback;
  }
}

function buildEmailSearchCondition(query: string) {
  const pattern = `%${query}%`;

  return or(
    like(emails.subject, pattern),
    like(emails.snippet, pattern),
    like(emails.fromAddr, pattern),
    like(emails.fromName, pattern),
    like(emails.toAddr, pattern),
    like(emails.bodyText, pattern),
  )!;
}

function buildInboxScopeConditions(scope: {
  mailboxId?: number;
  view: InboxView;
  now: number;
}) {
  const conditions = [];

  if (scope.mailboxId) {
    conditions.push(eq(emails.mailboxId, scope.mailboxId));
  }

  switch (scope.view) {
    case "inbox":
      conditions.push(hasEmailLabel(STANDARD_LABELS.INBOX));
      conditions.push(
        or(isNull(emails.snoozedUntil), lte(emails.snoozedUntil, scope.now))!,
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
      conditions.push(gt(emails.snoozedUntil, scope.now));
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

  return conditions;
}

function formatEmailDate(dateMs: number | null) {
  if (typeof dateMs !== "number" || Number.isNaN(dateMs)) {
    return {
      dateIso: null,
      dateLabel: null,
    };
  }

  const date = new Date(dateMs);

  return {
    dateIso: date.toISOString(),
    dateLabel: new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date),
  };
}

function getPendingReplyDraft(actions: EmailAction[] | null | undefined) {
  const replyAction = (actions ?? []).find(
    (action) => action.type === "reply" && action.status === "pending",
  );

  return typeof replyAction?.payload?.draft === "string"
    ? replyAction.payload.draft
    : null;
}

export function makeReadTools(
  db: Database,
  userId: string,
  env: Env,
  currentUrl?: string | null,
) {
  return {
    searchEmails: tool({
      description:
        "Search the signed-in user's emails by subject, sender, recipients, preview text, or body text. Use this when the user asks to find messages or references a company, sender, or topic.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("Plain-language search term to match against subject, sender, recipients, preview text, or body text."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .default(10)
          .describe("Maximum number of matching emails to return."),
      }),
      execute: async ({ query, limit }) => {
        const now = Date.now();
        const scope = parseInboxScope(currentUrl);

        await db
          .update(emails)
          .set({ snoozedUntil: null })
          .where(
            and(eq(emails.userId, userId), lte(emails.snoozedUntil, now)),
          );

        await catchUpAllMailboxes(db, env, userId);

        const rows = await db
          .select({
            id: emails.id,
            subject: emails.subject,
            fromAddr: emails.fromAddr,
            fromName: emails.fromName,
            toAddr: emails.toAddr,
            snippet: emails.snippet,
            date: emails.date,
            isRead: emails.isRead,
          })
          .from(emails)
          .where(
            and(
              eq(emails.userId, userId),
              ...buildInboxScopeConditions({ ...scope, now }),
              buildEmailSearchCondition(query),
            ),
          )
          .orderBy(desc(emails.date))
          .limit(limit);
        return {
          emails: rows.map((row) => ({
            ...row,
            ...formatEmailDate(row.date),
          })),
          count: rows.length,
        };
      },
    }),
    getEmail: tool({
      description:
        "Fetch a specific email by ID. Returns subject, sender, recipients, date, body text, and thread ID. Use when you need to read the full content of a known email.",
      inputSchema: z.object({
        emailId: z
          .number()
          .int()
          .positive()
          .describe("Numeric internal email ID."),
      }),
      execute: async ({ emailId }) => {
        const rows = await db
          .select({
            id: emails.id,
            subject: emails.subject,
            fromAddr: emails.fromAddr,
            fromName: emails.fromName,
            toAddr: emails.toAddr,
            ccAddr: emails.ccAddr,
            snippet: emails.snippet,
            bodyText: emails.bodyText,
            date: emails.date,
            isRead: emails.isRead,
            threadId: emails.threadId,
            mailboxId: emails.mailboxId,
            messageId: emails.messageId,
            intelligenceStatus: emailIntelligence.status,
            intelligenceCategory: emailIntelligence.category,
            intelligenceUrgency: emailIntelligence.urgency,
            intelligenceSuspiciousJson: emailIntelligence.suspiciousJson,
            intelligenceActionsJson: emailIntelligence.actionsJson,
          })
          .from(emails)
          .leftJoin(emailIntelligence, eq(emailIntelligence.emailId, emails.id))
          .where(and(eq(emails.id, emailId), eq(emails.userId, userId)))
          .limit(1);

        const email = rows[0];
        if (!email) return { error: "Email not found" };

        const intelligence = getStoredEmailClassification(
          email.intelligenceStatus
            ? {
                status: email.intelligenceStatus,
                category: email.intelligenceCategory,
                urgency: email.intelligenceUrgency,
                suspiciousJson: email.intelligenceSuspiciousJson ?? {
                  isSuspicious: false,
                  kind: null,
                  reason: null,
                  confidence: null,
                },
              }
            : null,
        );

        return {
          id: email.id,
          subject: email.subject,
          fromAddr: email.fromAddr,
          fromName: email.fromName,
          toAddr: email.toAddr,
          ccAddr: email.ccAddr,
          snippet: email.snippet,
          bodyText: (email.bodyText ?? "").replace(/\s+/g, " ").trim().slice(0, 3000),
          date: email.date,
          isRead: email.isRead,
          threadId: email.threadId,
          mailboxId: email.mailboxId,
          messageId: email.messageId,
          intelligenceStatus: email.intelligenceStatus ?? null,
          intelligence,
          draftReply: getPendingReplyDraft(email.intelligenceActionsJson),
          ...formatEmailDate(email.date),
        };
      },
    }),
    searchEmailsByDate: tool({
      description:
        "Search emails within a date range. Use when user asks about emails from a specific time period like 'last week', 'yesterday', or 'in March'.",
      inputSchema: z.object({
        after: z
          .number()
          .describe("Start of date range as Unix timestamp in milliseconds."),
        before: z
          .number()
          .describe("End of date range as Unix timestamp in milliseconds."),
        query: z
          .string()
          .optional()
          .describe("Optional text to filter by subject, sender, recipients, preview text, or body text."),
        limit: z.number().int().min(1).max(20).optional().default(10),
      }),
      execute: async ({ after, before, query, limit }) => {
        const now = Date.now();
        const scope = parseInboxScope(currentUrl);

        await db
          .update(emails)
          .set({ snoozedUntil: null })
          .where(
            and(eq(emails.userId, userId), lte(emails.snoozedUntil, now)),
          );

        await catchUpAllMailboxes(db, env, userId);

        const conditions = [
          eq(emails.userId, userId),
          sql`${emails.date} >= ${after}`,
          lte(emails.date, before),
          ...buildInboxScopeConditions({ ...scope, now }),
        ];

        if (query) {
          conditions.push(buildEmailSearchCondition(query));
        }

        const rows = await db
          .select({
            id: emails.id,
            subject: emails.subject,
            fromAddr: emails.fromAddr,
            fromName: emails.fromName,
            toAddr: emails.toAddr,
            snippet: emails.snippet,
            date: emails.date,
            isRead: emails.isRead,
          })
          .from(emails)
          .where(and(...conditions))
          .orderBy(desc(emails.date))
          .limit(limit);

        return {
          emails: rows.map((row) => ({ ...row, ...formatEmailDate(row.date) })),
          count: rows.length,
        };
      },
    }),

    summarizeEmail: tool({
      description:
        "Fetch an email and its recent thread context so the agent can summarize or reason about it.",
      inputSchema: z.object({
        emailId: z
          .number()
          .int()
          .positive()
          .describe("Numeric internal email ID from the CRM inbox."),
      }),
      execute: async ({ emailId }) => {
        const emailRow = await db
          .select({
            id: emails.id,
            threadId: emails.threadId,
            fromAddr: emails.fromAddr,
            fromName: emails.fromName,
            subject: emails.subject,
            date: emails.date,
            bodyText: emails.bodyText,
          })
          .from(emails)
          .where(and(eq(emails.id, emailId), eq(emails.userId, userId)))
          .limit(1);

        const email = emailRow[0];
        if (!email) return { error: "Email not found" };

        let context = "";
        if (email.threadId) {
          const threadMessages = await db
            .select({
              fromAddr: emails.fromAddr,
              fromName: emails.fromName,
              bodyText: emails.bodyText,
              date: emails.date,
            })
            .from(emails)
            .where(
              and(eq(emails.threadId, email.threadId), eq(emails.userId, userId)),
            )
            .orderBy(asc(emails.date))
            .limit(10);

          context = threadMessages
            .map((msg, i) => {
              const from = msg.fromName || msg.fromAddr;
              const body = (msg.bodyText ?? "").replace(/\s+/g, " ").trim().slice(0, 800);
              return `--- Message ${i + 1} from ${from} ---\n${body}`;
            })
            .join("\n\n");
        } else {
          context = (email.bodyText ?? "").replace(/\s+/g, " ").trim().slice(0, 2000);
        }

        return {
          subject: email.subject,
          from: email.fromName || email.fromAddr,
          date: email.date,
          ...formatEmailDate(email.date),
          threadContext: context,
        };
      },
    }),

    resolveContact: tool({
      description:
        "Look up a contact by name or email address. Use this BEFORE sending or composing an email when the user refers to someone by name (e.g. 'email Pedro', 'send to Sarah'). Returns matching contacts from email history. If multiple matches, present the options to the user and ask which one.",
      inputSchema: z.object({
        name: z
          .string()
          .describe("Name or email fragment to search for, e.g. 'Pedro' or 'acme.com'."),
      }),
      execute: async ({ name }) => {
        const pattern = `%${name}%`;

        const received = db
          .select({
            email: emails.fromAddr,
            name: emails.fromName,
            lastSeen: sql<number>`MAX(${emails.date})`.as("last_seen"),
            messageCount: sql<number>`COUNT(*)`.as("message_count"),
          })
          .from(emails)
          .where(
            and(
              eq(emails.userId, userId),
              or(
                like(emails.fromName, pattern),
                like(emails.fromAddr, pattern),
              ),
            ),
          )
          .groupBy(emails.fromAddr);

        const sent = db
          .select({
            email: emails.toAddr,
            name: sql<string | null>`NULL`.as("name"),
            lastSeen: sql<number>`MAX(${emails.date})`.as("last_seen"),
            messageCount: sql<number>`COUNT(*)`.as("message_count"),
          })
          .from(emails)
          .where(
            and(
              eq(emails.userId, userId),
              isNotNull(emails.toAddr),
              like(emails.toAddr, pattern),
            ),
          )
          .groupBy(emails.toAddr);

        const [receivedRows, sentRows] = await Promise.all([received, sent]);
        const allRows = [
          ...receivedRows,
          ...sentRows.filter(
            (row): row is {
              email: string;
              name: string | null;
              lastSeen: number;
              messageCount: number;
            } => row.email !== null,
          ),
        ];

        const contactMap = new Map<string, { email: string; name: string | null; lastSeen: number; messageCount: number }>();
        for (const row of allRows) {
          const addr = row.email.toLowerCase();
          const existing = contactMap.get(addr);
          if (!existing || row.lastSeen > existing.lastSeen) {
            contactMap.set(addr, {
              email: row.email,
              name: row.name || existing?.name || null,
              lastSeen: row.lastSeen,
              messageCount: (existing?.messageCount ?? 0) + row.messageCount,
            });
          }
        }

        const contacts = [...contactMap.values()]
          .sort((a, b) => b.lastSeen - a.lastSeen)
          .slice(0, 10)
          .map((c) => ({
            email: c.email,
            name: c.name,
            lastSeen: formatEmailDate(c.lastSeen).dateLabel,
            messageCount: c.messageCount,
          }));

        if (contacts.length === 0) {
          return { found: false, message: `No contacts found matching "${name}".` };
        }
        if (contacts.length === 1) {
          return { found: true, exact: true, contact: contacts[0] };
        }
        return {
          found: true,
          exact: false,
          message: `Found ${contacts.length} contacts matching "${name}". Ask the user which one they mean.`,
          contacts,
        };
      },
    }),
  };
}
