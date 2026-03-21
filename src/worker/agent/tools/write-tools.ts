import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db/client";
import { emails, notes, tasks } from "../../db/schema";
import {
  batchModifyGmailMessages,
  sendGmailMessage,
} from "../../lib/gmail/mailbox";
import { resolveOutgoingMailbox } from "../../lib/gmail/mailbox-state";
import { applyEmailPatch } from "../../routes/emails/mutation";

async function getEmailForUser(db: Database, userId: string, emailId: number) {
  const rows = await db
    .select({
      id: emails.id,
      gmailId: emails.gmailId,
      mailboxId: emails.mailboxId,
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
  if (!email.mailboxId) return { error: "Email has no linked mailbox" };

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
      email.mailboxId,
      env,
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
        await db
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
        "Send an email from the user's Gmail account. Use this when the user explicitly asks to send a message. The user may have multiple Gmail accounts connected.",
      inputSchema: z.object({
        mailboxId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Mailbox ID to send from when the user has multiple connected accounts."),
        to: z.string().email().describe("Recipient email address."),
        subject: z.string().describe("Email subject."),
        body: z.string().describe("Email body as plain text."),
        inReplyTo: z.string().optional().describe("Message-ID of the email being replied to."),
        threadId: z.string().optional().describe("Gmail thread ID if replying in a thread."),
      }),
      needsApproval: true,
      execute: async ({ mailboxId, to, subject, body, inReplyTo, threadId }) => {
        let mailbox;
        try {
          mailbox = await resolveOutgoingMailbox(db, userId, mailboxId);
        } catch (error) {
          return {
            error:
              error instanceof Error
                ? error.message
                : "Failed to resolve sender account",
          };
        }

        const fromEmail = mailbox.gmailEmail ?? userEmail;
        if (!fromEmail) return { error: "User email not available" };

        const result = await sendGmailMessage(db, env, mailbox.id, fromEmail, {
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
        mailboxId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Mailbox ID to preselect as the sender account."),
        to: z.string().email().optional().describe("Recipient email address."),
        subject: z.string().optional().describe("Email subject line."),
        body: z.string().describe("Email body content as HTML."),
      }),
      needsApproval: true,
      execute: async ({ mailboxId, to, subject, body }) => {
        return { action: "composeEmail", mailboxId, to, subject, body };
      },
    }),

  };
}
