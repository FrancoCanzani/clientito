import { createOpenAI } from "@ai-sdk/openai";
import { tool } from "ai";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db/client";
import { emails, notes, tasks } from "../../db/schema";
import {
  archiveGmailMessage,
  batchModifyGmailMessages,
  sendGmailMessage,
} from "../../lib/gmail/mailbox";
import { applyEmailPatch } from "../../routes/emails/mutation";

const MODEL = "gpt-5.4";

async function getEmailForUser(db: Database, userId: string, emailId: number) {
  const rows = await db
    .select({
      id: emails.id,
      gmailId: emails.gmailId,
      isRead: emails.isRead,
      labelIds: emails.labelIds,
      threadId: emails.threadId,
      fromAddr: emails.fromAddr,
      fromName: emails.fromName,
      subject: emails.subject,
      bodyText: emails.bodyText,
      messageId: emails.messageId,
      snoozedUntil: emails.snoozedUntil,
    })
    .from(emails)
    .where(and(eq(emails.id, emailId), eq(emails.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

async function patchEmailLabels(
  db: Database,
  env: Env,
  userId: string,
  emailId: number,
  mutation: { archived?: boolean; trashed?: boolean; spam?: boolean; starred?: boolean; isRead?: boolean },
) {
  const email = await getEmailForUser(db, userId, emailId);
  if (!email) return { error: "Email not found" };

  const patch = applyEmailPatch(email, mutation);

  if (Object.keys(patch.dbUpdates).length > 0) {
    await db
      .update(emails)
      .set(patch.dbUpdates)
      .where(and(eq(emails.id, emailId), eq(emails.userId, userId)));
  }

  if (patch.addLabelIds.length > 0 || patch.removeLabelIds.length > 0) {
    await batchModifyGmailMessages(
      db,
      env,
      userId,
      [email.gmailId],
      patch.addLabelIds.length > 0 ? patch.addLabelIds : undefined,
      patch.removeLabelIds.length > 0 ? patch.removeLabelIds : undefined,
    );
  }

  return { success: true, emailId };
}

export function makeWriteTools(
  db: Database,
  userId: string,
  userEmail: string | null,
  env: Env,
) {
  return {
    createTask: tool({
      description:
        "Create a new task for the user.",
      inputSchema: z.object({
        title: z.string().describe("Task title."),
        dueAt: z
          .number()
          .optional()
          .describe("Due date as Unix timestamp in milliseconds."),
      }),
      needsApproval: true,
      execute: async ({ title, dueAt }) => {
        const result = await db
          .insert(tasks)
          .values({ userId, title, dueAt: dueAt ?? null, status: "todo", createdAt: Date.now() })
          .returning({ id: tasks.id });
        return { created: true, taskId: result[0].id, title };
      },
    }),

    updateTask: tool({
      description:
        "Update an existing task. Can change status, title, due date, or priority.",
      inputSchema: z.object({
        taskId: z.number().int().positive().describe("Task ID to update."),
        status: z.enum(["backlog", "todo", "in_progress", "done"]).optional().describe("New status."),
        title: z.string().optional().describe("New task title."),
        dueAt: z.number().nullable().optional().describe("New due date (ms timestamp) or null to clear."),
        priority: z
          .enum(["urgent", "high", "medium", "low"])
          .optional()
          .describe("New priority level."),
      }),
      needsApproval: true,
      execute: async ({ taskId, status, title, dueAt, priority }) => {
        const existing = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
          .limit(1);
        if (!existing[0]) return { error: "Task not found" };

        const updates: Record<string, unknown> = {};
        if (status !== undefined) updates.status = status;
        if (title !== undefined) updates.title = title;
        if (dueAt !== undefined) updates.dueAt = dueAt;
        if (priority !== undefined) updates.priority = priority;

        if (Object.keys(updates).length === 0) return { error: "Nothing to update" };

        await db
          .update(tasks)
          .set(updates)
          .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
        return { updated: true, taskId };
      },
    }),

    deleteTask: tool({
      description: "Delete a task permanently.",
      inputSchema: z.object({
        taskId: z.number().int().positive().describe("Task ID to delete."),
      }),
      needsApproval: true,
      execute: async ({ taskId }) => {
        const result = await db
          .delete(tasks)
          .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
        return { deleted: true, taskId };
      },
    }),

    createNote: tool({
      description: "Create a new note.",
      inputSchema: z.object({
        title: z.string().describe("Note title."),
        content: z.string().describe("Note body content."),
      }),
      needsApproval: true,
      execute: async ({ title, content }) => {
        const now = Date.now();
        const result = await db
          .insert(notes)
          .values({ userId, title, content, createdAt: now, updatedAt: now })
          .returning({ id: notes.id });
        return { created: true, noteId: result[0].id, title };
      },
    }),

    archiveEmail: tool({
      description: "Archive an email (remove from inbox).",
      inputSchema: z.object({
        emailId: z.number().int().positive().describe("Email ID to archive."),
      }),
      needsApproval: true,
      execute: async ({ emailId }) => {
        return patchEmailLabels(db, env, userId, emailId, { archived: true });
      },
    }),

    trashEmail: tool({
      description: "Move an email to trash.",
      inputSchema: z.object({
        emailId: z.number().int().positive().describe("Email ID to trash."),
      }),
      needsApproval: true,
      execute: async ({ emailId }) => {
        return patchEmailLabels(db, env, userId, emailId, { trashed: true });
      },
    }),

    markEmailRead: tool({
      description: "Mark an email as read.",
      inputSchema: z.object({
        emailId: z.number().int().positive().describe("Email ID."),
      }),
      execute: async ({ emailId }) => {
        return patchEmailLabels(db, env, userId, emailId, { isRead: true });
      },
    }),

    markEmailUnread: tool({
      description: "Mark an email as unread.",
      inputSchema: z.object({
        emailId: z.number().int().positive().describe("Email ID."),
      }),
      execute: async ({ emailId }) => {
        return patchEmailLabels(db, env, userId, emailId, { isRead: false });
      },
    }),

    starEmail: tool({
      description: "Star an email.",
      inputSchema: z.object({
        emailId: z.number().int().positive().describe("Email ID."),
      }),
      needsApproval: true,
      execute: async ({ emailId }) => {
        return patchEmailLabels(db, env, userId, emailId, { starred: true });
      },
    }),

    unstarEmail: tool({
      description: "Remove star from an email.",
      inputSchema: z.object({
        emailId: z.number().int().positive().describe("Email ID."),
      }),
      execute: async ({ emailId }) => {
        return patchEmailLabels(db, env, userId, emailId, { starred: false });
      },
    }),

    sendEmail: tool({
      description:
        "Send an email from the user's Gmail account. Use this when the user explicitly asks to send a message.",
      inputSchema: z.object({
        to: z.string().email().describe("Recipient email address."),
        subject: z.string().describe("Email subject."),
        body: z.string().describe("Email body as plain text."),
        inReplyTo: z.string().optional().describe("Message-ID of the email being replied to."),
        threadId: z.string().optional().describe("Gmail thread ID if replying in a thread."),
      }),
      needsApproval: true,
      execute: async ({ to, subject, body, inReplyTo, threadId }) => {
        if (!userEmail) return { error: "User email not available" };

        const result = await sendGmailMessage(db, env, userId, userEmail, {
          to,
          subject,
          body,
          inReplyTo,
          threadId,
        });
        return { sent: true, gmailId: result.gmailId, threadId: result.threadId };
      },
    }),

    composeEmail: tool({
      description:
        "Open a compose window pre-filled with email content. Use when user wants to draft without sending immediately.",
      inputSchema: z.object({
        to: z.string().email().optional().describe("Recipient email address."),
        subject: z.string().optional().describe("Email subject line."),
        body: z.string().describe("Email body content as HTML."),
      }),
      needsApproval: true,
      execute: async ({ to, subject, body }) => {
        return { action: "composeEmail", to, subject, body };
      },
    }),

    draftReply: tool({
      description: "Generate a draft reply to an email thread. Does not send anything.",
      inputSchema: z.object({
        emailId: z.number().int().positive().describe("Email ID to reply to."),
        instructions: z
          .string()
          .optional()
          .describe("Guidance about tone, intent, or what to say."),
      }),
      execute: async ({ emailId, instructions }) => {
        const email = await getEmailForUser(db, userId, emailId);
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
            .where(and(eq(emails.threadId, email.threadId), eq(emails.userId, userId)))
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
          threadContext = `--- Original email from ${email.fromName || email.fromAddr} ---\n${(email.bodyText ?? "").replace(/\s+/g, " ").trim().slice(0, 1000)}`;
        }

        const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
        const { streamText } = await import("ai");
        const result = streamText({
          model: openai.responses(MODEL),
          system:
            "You are a helpful email assistant. Draft a concise, professional reply. Match the conversation tone. Return only the reply body text.",
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
