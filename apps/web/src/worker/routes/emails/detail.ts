import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { customers, emails, syncState } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import {
  extractMessageAttachments,
  extractMessageBodyHtml,
  extractMessageBodyText,
  getGmailMessageById,
  isGmailReconnectRequiredError,
  type GmailAttachmentMeta,
} from "../../lib/gmail";
import type { AppRouteEnv } from "../types";
import { toEmailListResponse } from "./helpers";
import {
  emailDetailQuerySchema,
  emailDetailResponseSchema,
  errorResponseSchema,
} from "./schemas";

const getEmailDetailRoute = createRoute({
  method: "get",
  path: "/detail",
  tags: ["emails"],
  request: {
    query: emailDetailQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: emailDetailResponseSchema,
        },
      },
      description: "Email detail",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
    403: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Forbidden",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Not found",
    },
  },
});

const HAS_ATTACHMENT_LABEL = "HAS_ATTACHMENT";

function normalizeCid(value: string): string {
  return value.trim().replace(/^<|>$/g, "").toLowerCase();
}

function buildAttachmentUrl(input: {
  orgId: string;
  gmailMessageId: string;
  attachmentId: string;
  filename?: string | null;
  mimeType?: string | null;
  inline?: boolean;
}): string {
  const params = new URLSearchParams({
    orgId: input.orgId,
    gmailMessageId: input.gmailMessageId,
    attachmentId: input.attachmentId,
  });

  if (input.filename) {
    params.set("filename", input.filename);
  }
  if (input.mimeType) {
    params.set("mimeType", input.mimeType);
  }
  if (input.inline) {
    params.set("inline", "true");
  }

  return `/api/emails/attachment?${params.toString()}`;
}

function resolveInlineCidImages(
  html: string,
  orgId: string,
  gmailMessageId: string,
  attachments: GmailAttachmentMeta[],
): string {
  const inlineByCid = new Map<string, GmailAttachmentMeta>();

  for (const attachment of attachments) {
    if (!attachment.contentId) {
      continue;
    }

    inlineByCid.set(normalizeCid(attachment.contentId), attachment);
  }

  if (inlineByCid.size === 0) {
    return html;
  }

  return html.replace(
    /\bsrc\s*=\s*(['"])cid:([^"']+)\1/gi,
    (_match, quote: string, cidValue: string) => {
      const attachment = inlineByCid.get(normalizeCid(cidValue));
      if (!attachment) {
        return `src=${quote}cid:${cidValue}${quote}`;
      }

      const inlineUrl = buildAttachmentUrl({
        orgId,
        gmailMessageId,
        attachmentId: attachment.attachmentId,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        inline: true,
      });

      return `src=${quote}${inlineUrl}${quote}`;
    },
  );
}

export function registerGetEmailDetail(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(getEmailDetailRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { orgId, emailId, skipLive } = c.req.valid("query");
    if (!(await ensureOrgAccess(db, orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const row = await db
      .select({
        id: emails.id,
        gmailId: emails.gmailId,
        fromAddr: emails.fromAddr,
        fromName: emails.fromName,
        toAddr: emails.toAddr,
        subject: emails.subject,
        snippet: emails.snippet,
        bodyText: emails.bodyText,
        bodyHtml: emails.bodyHtml,
        threadId: emails.threadId,
        date: emails.date,
        isRead: emails.isRead,
        labelIds: emails.labelIds,
        isCustomer: emails.isCustomer,
        classified: emails.classified,
        createdAt: emails.createdAt,
        customerId: emails.customerId,
        customerName: customers.name,
      })
      .from(emails)
      .leftJoin(customers, eq(emails.customerId, customers.id))
      .where(and(eq(emails.orgId, orgId), eq(emails.id, emailId)))
      .limit(1);

    const first = row[0];
    if (!first) {
      return c.json({ error: "Email not found" }, 404);
    }

    const baseEmail = toEmailListResponse({
      ...first,
      id: String(first.id),
      customerId: first.customerId ? String(first.customerId) : null,
    });

    let resolvedBodyText = baseEmail.bodyText;
    let resolvedBodyHtml = baseEmail.bodyHtml;
    let attachments: Array<{
      attachmentId: string;
      filename: string | null;
      mimeType: string | null;
      size: number | null;
      contentId: string | null;
      isInline: boolean;
      isImage: boolean;
      downloadUrl: string;
      inlineUrl: string | null;
    }> = [];

    const orgSyncState = await db.query.syncState.findFirst({
      where: eq(syncState.orgId, orgId),
    });
    const gmailUserId = orgSyncState?.userId ?? user.id;

    if (!skipLive) {
      try {
        const message = await getGmailMessageById(
          db,
          c.env,
          gmailUserId,
          baseEmail.gmailId,
        );

        const messageBodyText = extractMessageBodyText(message);
        const messageBodyHtml = extractMessageBodyHtml(message);
        const messageAttachments = extractMessageAttachments(message);
        const hasLiveAttachments = messageAttachments.length > 0;

        resolvedBodyText = messageBodyText ?? resolvedBodyText;
        resolvedBodyHtml = messageBodyHtml ?? resolvedBodyHtml;

        if (resolvedBodyHtml) {
          resolvedBodyHtml = resolveInlineCidImages(
            resolvedBodyHtml,
            orgId,
            baseEmail.gmailId,
            messageAttachments,
          );
        }

        if (
          hasLiveAttachments &&
          !baseEmail.labelIds.includes(HAS_ATTACHMENT_LABEL)
        ) {
          const nextLabelIds = [...baseEmail.labelIds, HAS_ATTACHMENT_LABEL];
          baseEmail.labelIds = nextLabelIds;
          baseEmail.hasAttachment = true;
          await db
            .update(emails)
            .set({ labelIds: nextLabelIds })
            .where(and(eq(emails.orgId, orgId), eq(emails.id, emailId)));
        }

        attachments = messageAttachments.map((attachment) => {
          const downloadUrl = buildAttachmentUrl({
            orgId,
            gmailMessageId: baseEmail.gmailId,
            attachmentId: attachment.attachmentId,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
          });
          const inlineUrl = attachment.isInline
            ? buildAttachmentUrl({
                orgId,
                gmailMessageId: baseEmail.gmailId,
                attachmentId: attachment.attachmentId,
                filename: attachment.filename,
                mimeType: attachment.mimeType,
                inline: true,
              })
            : null;

          return {
            ...attachment,
            downloadUrl,
            inlineUrl,
          };
        });
      } catch (error) {
        if (isGmailReconnectRequiredError(error)) {
          console.warn("Live Gmail detail skipped: reconnect required", {
            orgId,
            emailId,
            gmailId: baseEmail.gmailId,
          });
        } else {
          console.error("Failed to fetch live Gmail detail for email", {
            orgId,
            emailId,
            gmailId: baseEmail.gmailId,
            error,
          });
        }
      }
    }

    return c.json(
      {
        data: {
          ...baseEmail,
          resolvedBodyText,
          resolvedBodyHtml,
          attachments,
        },
      },
      200,
    );
  });
}
