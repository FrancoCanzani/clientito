import { tool } from "ai";
import { and, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db/client";
import { emails, mailboxes } from "../../db/schema";
import { GmailDriver } from "../../lib/gmail/driver";
import { STANDARD_LABELS } from "../../lib/gmail/types";
import { chunkArray } from "../../lib/utils";
import { resolveOutgoingMailbox, ensureMailbox } from "../../lib/gmail/sync/state";
import { markEmailSubscriptionStatus, normalizeUnsubscribeUrl, normalizeUnsubscribeEmail } from "../../lib/gmail/subscriptions/service";
import { applyEmailPatch } from "../../routes/inbox/emails/internal/mutation";
import { hasEmailLabel } from "../../routes/inbox/emails/utils";

async function getEmailForUser(db: Database, userId: string, emailId: number) {
  const rows = await db
    .select({
      id: emails.id,
      providerMessageId: emails.providerMessageId,
      mailboxId: emails.mailboxId,
      isRead: emails.isRead,
      labelIds: emails.labelIds,
      threadId: emails.threadId,
      fromAddr: emails.fromAddr,
      fromName: emails.fromName,
      toAddr: emails.toAddr,
      ccAddr: emails.ccAddr,
      subject: emails.subject,
      bodyText: emails.bodyText,
      bodyHtml: emails.bodyHtml,
      date: emails.date,
      messageId: emails.messageId,
      snoozedUntil: emails.snoozedUntil,
    })
    .from(emails)
    .where(and(eq(emails.id, emailId), eq(emails.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

async function getEmailForForwarding(
  db: Database,
  env: Env,
  userId: string,
  emailId: number,
) {
  const email = await getEmailForUser(db, userId, emailId);
  if (!email) return null;

  if (!email.mailboxId) {
    return email;
  }

  try {
    const provider = new GmailDriver(db, env, email.mailboxId);
    const rawMessage = await provider.fetchMessage(email.providerMessageId);

    return {
      ...email,
      bodyHtml: rawMessage.bodyHtml ?? email.bodyHtml,
      bodyText: rawMessage.bodyText ?? email.bodyText,
    };
  } catch {
    return email;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildForwardedEmailHtml(email: NonNullable<Awaited<ReturnType<typeof getEmailForUser>>>) {
  const fromLine = email.fromName
    ? `${escapeHtml(email.fromName)} &lt;${escapeHtml(email.fromAddr)}&gt;`
    : escapeHtml(email.fromAddr);
  const dateLine = new Date(email.date).toLocaleString();
  const subjectLine = escapeHtml(email.subject ?? "(no subject)");
  const toLine = email.toAddr?.trim() ? escapeHtml(email.toAddr) : null;
  const ccLine = email.ccAddr?.trim() ? escapeHtml(email.ccAddr) : null;
  const originalBody = email.bodyHtml?.trim().length
    ? email.bodyHtml
    : `<div style="white-space:pre-wrap">${escapeHtml(email.bodyText ?? "")}</div>`;

  return [
    "<p><br></p>",
    '<div data-forwarded-message="true" style="border-top:1px solid #dadce0;margin-top:16px;padding-top:16px;color:#5f6368;font-size:13px">',
    '<div data-forwarded-header="true">---------- Forwarded message ---------</div>',
    `<div><strong>From:</strong> ${fromLine}</div>`,
    `<div><strong>Date:</strong> ${escapeHtml(dateLine)}</div>`,
    `<div><strong>Subject:</strong> ${subjectLine}</div>`,
    ...(toLine ? [`<div><strong>To:</strong> ${toLine}</div>`] : []),
    ...(ccLine ? [`<div><strong>Cc:</strong> ${ccLine}</div>`] : []),
    "<br>",
    `<div data-forwarded-original-body="true">${originalBody}</div>`,
    "</div>",
  ].join("");
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
    const provider = new GmailDriver(db, env, email.mailboxId);
    await provider.modifyLabels(
      [email.providerMessageId],
      patch.addLabelIds,
      patch.removeLabelIds,
    );
  }

  return { success: true, emailId };
}

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

async function markAllEmailsReadInScope(
  db: Database,
  env: Env,
  userId: string,
  scope: { mailboxId?: number; view: InboxView },
) {
  const now = Date.now();
  const conditions = [eq(emails.userId, userId), eq(emails.isRead, false)];

  if (scope.mailboxId) {
    conditions.push(eq(emails.mailboxId, scope.mailboxId));
  }

  switch (scope.view) {
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
  }

  const rows = await db
    .select({
      id: emails.id,
      providerMessageId: emails.providerMessageId,
      mailboxId: emails.mailboxId,
      isRead: emails.isRead,
      labelIds: emails.labelIds,
      snoozedUntil: emails.snoozedUntil,
    })
    .from(emails)
    .where(and(...conditions));

  if (rows.length === 0) {
    return {
      updated: 0,
      view: scope.view,
      mailboxId: scope.mailboxId ?? null,
    };
  }

  const providerGroups = new Map<
    number,
    {
      providerMessageIds: string[];
      rowIds: number[];
    }
  >();

  const changedRows = rows
    .map((row) => ({
      row,
      patch: applyEmailPatch(row, { isRead: true }),
    }))
    .filter(({ patch }) => Object.keys(patch.dbUpdates).length > 0);

  const dbIdChunks = chunkArray(
    changedRows.map(({ row }) => row.id),
    90,
  );

  for (const chunk of dbIdChunks) {
    await db
      .update(emails)
      .set({ isRead: true })
      .where(and(eq(emails.userId, userId), inArray(emails.id, chunk)));
  }

  for (const { row, patch } of changedRows) {
    if (patch.removeLabelIds.length === 0 || !row.mailboxId) continue;
    const group = providerGroups.get(row.mailboxId);
    if (group) {
      group.providerMessageIds.push(row.providerMessageId);
      group.rowIds.push(row.id);
    } else {
      providerGroups.set(row.mailboxId, {
        providerMessageIds: [row.providerMessageId],
        rowIds: [row.id],
      });
    }
  }

  for (const [mailboxId, group] of providerGroups) {
    const provider = new GmailDriver(db, env, mailboxId);
    await provider.modifyLabels(
      group.providerMessageIds,
      [],
      [STANDARD_LABELS.UNREAD],
    );
  }

  return {
    updated: changedRows.length,
    view: scope.view,
    mailboxId: scope.mailboxId ?? null,
  };
}

export function makeWriteTools(
  db: Database,
  userId: string,
  userEmail: string | null,
  env: Env,
  currentUrl?: string | null,
  pageContext?: {
    entity?: {
      type?: string;
      id?: string;
      mailboxId?: number | null;
    };
  },
) {
  function getContextEmailHint() {
    const entity = pageContext?.entity;
    if (
      entity?.type === "email" &&
      typeof entity.id === "string" &&
      /^\d+$/.test(entity.id)
    ) {
      return {
        emailId: Number(entity.id),
        mailboxId: entity.mailboxId ?? undefined,
      };
    }

    if (!currentUrl) {
      return null;
    }

    try {
      const url = new URL(currentUrl);
      const emailId = url.searchParams.get("id");
      if (emailId && /^\d+$/.test(emailId)) {
        return { emailId: Number(emailId), mailboxId: undefined };
      }
    } catch {
      return null;
    }

    return null;
  }

  return {
    archiveEmail: tool({
      description: "Archive an email (remove from inbox).",
      inputSchema: z.object({
        emailId: z.number().int().positive().describe("Email ID to archive."),
      }),
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

    markAllEmailsRead: tool({
      description:
        "Mark all unread emails as read in the user's current inbox view. Use this for requests like 'mark all as read'.",
      inputSchema: z.object({}),
      needsApproval: true,
      execute: async () => {
        const scope = parseInboxScope(currentUrl);
        return markAllEmailsReadInScope(db, env, userId, scope);
      },
    }),

    starEmail: tool({
      description: "Star an email.",
      inputSchema: z.object({
        emailId: z.number().int().positive().describe("Email ID."),
      }),
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
        subject: z.string().optional().describe("Email subject."),
        body: z.string().optional().describe("Email body as HTML."),
        inReplyTo: z.string().optional().describe("Message-ID of the email being replied to."),
        threadId: z.string().optional().describe("Gmail thread ID if replying in a thread."),
        forwardEmailId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Email ID to forward directly when the user asks to forward an existing email."),
      }),
      needsApproval: true,
      execute: async ({ mailboxId, to, subject, body, inReplyTo, threadId, forwardEmailId }) => {
        let mailbox;
        try {
          let resolvedMailboxId = mailboxId;
          let resolvedSubject = subject;
          let resolvedBody = body ?? "";
          let sourceEmail =
            forwardEmailId !== undefined
              ? await getEmailForForwarding(db, env, userId, forwardEmailId)
              : null;

          if (!sourceEmail && !resolvedSubject?.trim() && !resolvedBody.trim()) {
            const contextEmail = getContextEmailHint();
            if (contextEmail?.emailId) {
              sourceEmail = await getEmailForForwarding(
                db,
                env,
                userId,
                contextEmail.emailId,
              );
              resolvedMailboxId = resolvedMailboxId ?? contextEmail.mailboxId;
            }
          }

          if (forwardEmailId && !sourceEmail) {
            return { error: "Email to forward not found" };
          }

          if (sourceEmail) {
            if (!forwardEmailId && !resolvedSubject?.trim() && !resolvedBody.trim()) {
              resolvedMailboxId = resolvedMailboxId ?? sourceEmail.mailboxId ?? undefined;
            }

            if (forwardEmailId || (!resolvedSubject?.trim() && !resolvedBody.trim())) {
              resolvedMailboxId = resolvedMailboxId ?? sourceEmail.mailboxId ?? undefined;
              resolvedSubject =
                resolvedSubject ??
                (sourceEmail.subject?.startsWith("Fwd:")
                  ? sourceEmail.subject
                  : `Fwd: ${sourceEmail.subject ?? ""}`.trim());

              const forwardedHtml = buildForwardedEmailHtml(sourceEmail);
              const preface = resolvedBody.trim();
              resolvedBody = preface.length > 0
                ? `${resolvedBody}<p><br></p>${forwardedHtml}`
                : forwardedHtml;
            }
          }

          if (!resolvedSubject?.trim()) {
            return { error: "Email subject is required" };
          }

          if (!resolvedBody.trim()) {
            return { error: "Email body is required" };
          }

          mailbox = await resolveOutgoingMailbox(db, userId, resolvedMailboxId);

          const fromEmail = mailbox.email ?? userEmail;
          if (!fromEmail) return { error: "User email not available" };

          const provider = new GmailDriver(db, env, mailbox.id);
          const result = await provider.send(fromEmail, {
            to,
            subject: resolvedSubject,
            body: resolvedBody,
            inReplyTo,
            threadId,
          });
          return { sent: true, providerMessageId: result.providerMessageId, threadId: result.threadId };
        } catch (error) {
          return {
            error:
              error instanceof Error
                ? error.message
                : "Failed to resolve sender account",
          };
        }
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
        body: z.string().optional().describe("Email body content as HTML."),
        forwardEmailId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Email ID to forward. Use this when the user asks to forward an existing email."),
      }),
      needsApproval: true,
      execute: async ({ mailboxId, to, subject, body, forwardEmailId }) => {
        let resolvedMailboxId = mailboxId;
        let resolvedSubject = subject;
        let resolvedBody = body ?? "";
        let sourceEmail =
          forwardEmailId !== undefined
            ? await getEmailForForwarding(db, env, userId, forwardEmailId)
            : null;

        if (!sourceEmail && !resolvedSubject?.trim() && !resolvedBody.trim()) {
          const contextEmail = getContextEmailHint();
          if (contextEmail?.emailId) {
            sourceEmail = await getEmailForForwarding(
              db,
              env,
              userId,
              contextEmail.emailId,
            );
            resolvedMailboxId = resolvedMailboxId ?? contextEmail.mailboxId;
          }
        }

        if (forwardEmailId && !sourceEmail) {
          return { error: "Email to forward not found" };
        }

        if (sourceEmail) {
          resolvedMailboxId = resolvedMailboxId ?? sourceEmail.mailboxId ?? undefined;
          resolvedSubject =
            resolvedSubject ??
            (sourceEmail.subject?.startsWith("Fwd:")
              ? sourceEmail.subject
              : `Fwd: ${sourceEmail.subject ?? ""}`.trim());

          const forwardedHtml = buildForwardedEmailHtml(sourceEmail);
          const preface = resolvedBody.trim();
          resolvedBody = preface.length > 0
            ? `${resolvedBody}<p><br></p>${forwardedHtml}`
            : forwardedHtml;
        }

        return {
          action: "composeEmail",
          mailboxId: resolvedMailboxId,
          to,
          subject: resolvedSubject,
          body: resolvedBody,
        };
      },
    }),

    batchArchive: tool({
      description: "Archive multiple emails at once. Use for bulk operations like 'archive all newsletters'.",
      inputSchema: z.object({
        emailIds: z.array(z.number().int().positive()).min(1).max(50).describe("Email IDs to archive."),
      }),
      needsApproval: true,
      execute: async ({ emailIds }) => {
        const results = await Promise.allSettled(
          emailIds.map((id) => patchEmailLabels(db, env, userId, id, { archived: true })),
        );
        const succeeded = results.filter((r) => r.status === "fulfilled").length;
        return { archived: succeeded, total: emailIds.length };
      },
    }),

    batchTrash: tool({
      description: "Move multiple emails to trash at once.",
      inputSchema: z.object({
        emailIds: z.array(z.number().int().positive()).min(1).max(50).describe("Email IDs to trash."),
      }),
      needsApproval: true,
      execute: async ({ emailIds }) => {
        const results = await Promise.allSettled(
          emailIds.map((id) => patchEmailLabels(db, env, userId, id, { trashed: true })),
        );
        const succeeded = results.filter((r) => r.status === "fulfilled").length;
        return { trashed: succeeded, total: emailIds.length };
      },
    }),

    snoozeEmail: tool({
      description: "Snooze an email until a specific time. The email will reappear in the inbox after the snooze period.",
      inputSchema: z.object({
        emailId: z.number().int().positive().describe("Email ID to snooze."),
        until: z.number().describe("Unix timestamp in milliseconds for when the email should reappear."),
      }),
      execute: async ({ emailId, until }) => {
        const email = await getEmailForUser(db, userId, emailId);
        if (!email) return { error: "Email not found" };

        await db
          .update(emails)
          .set({ snoozedUntil: until })
          .where(and(eq(emails.id, emailId), eq(emails.userId, userId)));

        return { snoozed: true, emailId, until: new Date(until).toISOString() };
      },
    }),

    unsubscribeEmail: tool({
      description: "Unsubscribe from an email sender. Uses the email's unsubscribe headers when available.",
      inputSchema: z.object({
        emailId: z.number().int().positive().describe("Email ID to unsubscribe from."),
      }),
      needsApproval: true,
      execute: async ({ emailId }) => {
        const rows = await db
          .select({
            id: emails.id,
            fromAddr: emails.fromAddr,
            unsubscribeUrl: emails.unsubscribeUrl,
            unsubscribeEmail: emails.unsubscribeEmail,
            mailboxId: emails.mailboxId,
          })
          .from(emails)
          .where(and(eq(emails.id, emailId), eq(emails.userId, userId)))
          .limit(1);

        const email = rows[0];
        if (!email) return { error: "Email not found" };

        const unsubUrl = normalizeUnsubscribeUrl(email.unsubscribeUrl ?? undefined);
        const unsubEmail = normalizeUnsubscribeEmail(email.unsubscribeEmail ?? undefined);

        if (!unsubUrl && !unsubEmail) {
          return { error: "No unsubscribe method available for this email" };
        }

        if (unsubUrl) {
          try {
            const res = await fetch(unsubUrl, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: "List-Unsubscribe=One-Click-Unsubscribe",
            });
            if (res.ok || res.status === 204 || res.status === 302) {
              await markEmailSubscriptionStatus(db, userId, {
                fromAddr: email.fromAddr,
                unsubscribeUrl: unsubUrl,
                unsubscribeEmail: unsubEmail,
                status: "unsubscribed",
                method: "one-click",
              });
              return { unsubscribed: true, method: "one-click", fromAddr: email.fromAddr };
            }
          } catch {
            // fall through to mailto
          }
        }

        if (unsubEmail) {
          const userMailboxes = await db
            .select()
            .from(mailboxes)
            .where(eq(mailboxes.userId, userId));
          const mailbox = userMailboxes[0] ?? await ensureMailbox(db, userId, null);
          if (!mailbox) return { error: "No mailbox configured" };

          const provider = new GmailDriver(db, env, mailbox.id);
          await provider.send(mailbox.email ?? userEmail ?? "", {
            to: unsubEmail,
            subject: "Unsubscribe",
            body: "Unsubscribe",
          });
          await markEmailSubscriptionStatus(db, userId, {
            fromAddr: email.fromAddr,
            unsubscribeUrl: unsubUrl,
            unsubscribeEmail: unsubEmail,
            status: "unsubscribed",
            method: "mailto",
          });
          return { unsubscribed: true, method: "mailto", fromAddr: email.fromAddr };
        }

        await markEmailSubscriptionStatus(db, userId, {
          fromAddr: email.fromAddr,
          unsubscribeUrl: unsubUrl,
          unsubscribeEmail: unsubEmail,
          status: "pending_manual",
          method: "manual",
        });
        return { unsubscribed: false, method: "manual", fromAddr: email.fromAddr, message: "Automatic unsubscribe failed. The user may need to unsubscribe manually." };
      },
    }),

  };
}
