import { createOpenAI } from "@ai-sdk/openai";
import { tool } from "ai";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db/client";
import { emails, notes, tasks } from "../../db/schema";
import { archiveGmailMessage } from "../../lib/gmail/modify";

const MODEL = "gpt-5.4";

export function makeWriteTools(db: Database, userId: string, env: Env) {
  return {
    createTask: tool({
      description:
        "Create a new CRM task for the signed-in user. Use this for follow-ups, reminders, or action items.",
      inputSchema: z.object({
        title: z
          .string()
          .describe("Clear task title describing the action to take."),
        dueAt: z
          .number()
          .optional()
          .describe("Optional due date as a Unix timestamp in milliseconds."),
      }),
      needsApproval: true,
      execute: async ({ title, dueAt }) => {
        const now = Date.now();
        const result = await db.insert(tasks).values({
          userId,
          title,
          dueAt: dueAt ?? null,
          done: false,
          createdAt: now,
        }).returning({ id: tasks.id });
        return { created: true, taskId: result[0].id, title };
      },
    }),

    createNote: tool({
      description:
        "Create a new CRM note for the signed-in user.",
      inputSchema: z.object({
        title: z.string().describe("Short note title."),
        content: z.string().describe("Full note body content."),
      }),
      needsApproval: true,
      execute: async ({ title, content }) => {
        const now = Date.now();
        const result = await db.insert(notes).values({
          userId,
          title,
          content,
          createdAt: now,
          updatedAt: now,
        }).returning({ id: notes.id });
        return { created: true, noteId: result[0].id, title };
      },
    }),

    archiveEmail: tool({
      description:
        "Archive an email by removing it from the inbox.",
      inputSchema: z.object({
        emailId: z
          .number()
          .int()
          .positive()
          .describe("Numeric internal email ID to archive."),
      }),
      needsApproval: true,
      execute: async ({ emailId }) => {
        const emailRow = await db
          .select({ gmailId: emails.gmailId })
          .from(emails)
          .where(and(eq(emails.id, emailId), eq(emails.userId, userId)))
          .limit(1);

        const email = emailRow[0];
        if (!email) return { error: "Email not found" };

        await archiveGmailMessage(db, env, userId, email.gmailId);
        return { archived: true, emailId };
      },
    }),

    draftReply: tool({
      description:
        "Generate a concise draft reply to an email thread.",
      inputSchema: z.object({
        emailId: z
          .number()
          .int()
          .positive()
          .describe("Numeric internal email ID to reply to."),
        instructions: z
          .string()
          .optional()
          .describe("Optional extra guidance about tone, intent, or what to say."),
      }),
      needsApproval: true,
      execute: async ({ emailId, instructions }) => {
        const emailRow = await db
          .select({
            id: emails.id,
            threadId: emails.threadId,
            fromAddr: emails.fromAddr,
            fromName: emails.fromName,
            subject: emails.subject,
            bodyText: emails.bodyText,
          })
          .from(emails)
          .where(and(eq(emails.id, emailId), eq(emails.userId, userId)))
          .limit(1);

        const email = emailRow[0];
        if (!email) return { error: "Email not found" };

        let threadContext = "";
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
            .limit(5);

          threadContext = threadMessages
            .map((msg, i) => {
              const from = msg.fromName || msg.fromAddr;
              const body = (msg.bodyText ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
              return `--- Message ${i + 1} from ${from} ---\n${body}`;
            })
            .join("\n\n");
        } else {
          const body = (email.bodyText ?? "").replace(/\s+/g, " ").trim().slice(0, 1000);
          threadContext = `--- Original email from ${email.fromName || email.fromAddr} ---\n${body}`;
        }

        const openai = createOpenAI({
          apiKey: env.OPENAI_API_KEY,
        });
        const { streamText } = await import("ai");
        const result = streamText({
          model: openai.responses(MODEL),
          system: "You are a helpful email assistant. Draft a concise, professional reply. Match the conversation tone. Return only the reply body text.",
          prompt: [
            `Subject: ${email.subject ?? "(no subject)"}`,
            "",
            "Thread context:",
            threadContext,
            "",
            instructions ? `Instructions: ${instructions}` : "Write a natural, concise reply.",
          ].join("\n"),
        });

        let draft = "";
        for await (const chunk of result.textStream) {
          draft += chunk;
        }

        return { draft: draft.trim(), emailId, subject: email.subject };
      },
    }),
  };
}
