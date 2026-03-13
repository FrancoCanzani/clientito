import { tool } from "ai";
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db/client";
import { companies, emails, people, tasks } from "../../db/schema";

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

export function makeReadTools(db: Database, userId: string) {
  return {
    searchEmails: tool({
      description:
        "Search the signed-in user's emails by subject, sender address, sender name, or snippet text. Use this when the user asks to find messages or references a company, sender, or topic.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("Plain-language search term to match against subject, sender, or email preview text."),
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
        const pattern = `%${query}%`;
        const rows = await db
          .select({
            id: emails.id,
            subject: emails.subject,
            fromAddr: emails.fromAddr,
            fromName: emails.fromName,
            snippet: emails.snippet,
            date: emails.date,
            isRead: emails.isRead,
          })
          .from(emails)
          .where(
            and(
              eq(emails.userId, userId),
              or(
                like(emails.subject, pattern),
                like(emails.fromAddr, pattern),
                like(emails.snippet, pattern),
              ),
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

    lookupPerson: tool({
      description:
        "Look up CRM people records for the signed-in user by email address or person name.",
      inputSchema: z.object({
        email: z
          .string()
          .optional()
          .describe("Full or partial email address to search for."),
        name: z
          .string()
          .optional()
          .describe("Full or partial person name to search for."),
      }),
      execute: async ({ email, name }) => {
        const conditions = [eq(people.userId, userId)];
        if (email) conditions.push(like(people.email, `%${email}%`));
        if (name) conditions.push(like(people.name, `%${name}%`));

        const rows = await db
          .select({
            id: people.id,
            email: people.email,
            name: people.name,
            title: people.title,
            phone: people.phone,
            companyName: companies.name,
            companyDomain: companies.domain,
            lastContactedAt: people.lastContactedAt,
          })
          .from(people)
          .leftJoin(companies, eq(people.companyId, companies.id))
          .where(and(...conditions))
          .limit(5);
        return { people: rows, count: rows.length };
      },
    }),

    lookupCompany: tool({
      description:
        "Look up CRM company records for the signed-in user by company domain or company name.",
      inputSchema: z.object({
        domain: z
          .string()
          .optional()
          .describe("Company website domain such as stripe.com."),
        name: z
          .string()
          .optional()
          .describe("Full or partial company name."),
      }),
      execute: async ({ domain, name }) => {
        const conditions = [eq(companies.userId, userId)];
        if (domain) conditions.push(like(companies.domain, `%${domain}%`));
        if (name) conditions.push(like(companies.name, `%${name}%`));

        const rows = await db
          .select({
            id: companies.id,
            name: companies.name,
            domain: companies.domain,
            industry: companies.industry,
            website: companies.website,
            description: companies.description,
          })
          .from(companies)
          .where(and(...conditions))
          .limit(5);
        return { companies: rows, count: rows.length };
      },
    }),

    listTasks: tool({
      description:
        "List the signed-in user's CRM tasks. Use dueToday=true for tasks due today. By default only incomplete tasks are returned.",
      inputSchema: z.object({
        dueToday: z
          .boolean()
          .optional()
          .describe("Set to true to return only tasks due today in the user's local day."),
        includeCompleted: z
          .boolean()
          .optional()
          .default(false)
          .describe("Set to true to include completed tasks in the results."),
      }),
      execute: async ({ dueToday, includeCompleted }) => {
        const conditions = [eq(tasks.userId, userId)];
        if (!includeCompleted) conditions.push(eq(tasks.done, false));
        if (dueToday) {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date();
          endOfDay.setHours(23, 59, 59, 999);
          conditions.push(
            sql`${tasks.dueAt} >= ${startOfDay.getTime()} AND ${tasks.dueAt} <= ${endOfDay.getTime()}`,
          );
        }

        const rows = await db
          .select({
            id: tasks.id,
            title: tasks.title,
            dueAt: tasks.dueAt,
            done: tasks.done,
            createdAt: tasks.createdAt,
          })
          .from(tasks)
          .where(and(...conditions))
          .orderBy(asc(tasks.dueAt))
          .limit(20);
        return { tasks: rows, count: rows.length };
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
  };
}
