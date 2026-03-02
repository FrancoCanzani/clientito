import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { emails } from "../../db/schema";
import {
  extractMessageAttachments,
  extractMessageBodyHtml,
  extractMessageBodyText,
  getGmailMessageById,
  isGmailReconnectRequiredError,
  type GmailAttachmentMeta,
} from "../../lib/gmail";
import type { AppRouteEnv } from "../types";
import {
  emailDetailQuerySchema,
  emailDetailResponseSchema,
  errorResponseSchema,
} from "./schemas";
import { toEmailListResponse } from "./utils";

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
  gmailMessageId: string;
  attachmentId: string;
  filename?: string | null;
  mimeType?: string | null;
  inline?: boolean;
}): string {
  const params = new URLSearchParams({
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

    const { emailId, skipLive } = c.req.valid("query");

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
        direction: emails.direction,
        isRead: emails.isRead,
        labelIds: emails.labelIds,
        personId: emails.personId,
        createdAt: emails.createdAt,
      })
      .from(emails)
      .where(and(eq(emails.userId, user.id), eq(emails.id, Number(emailId))))
      .limit(1);

    const first = row[0];
    if (!first) {
      return c.json({ error: "Email not found" }, 404);
    }

    const baseEmail = toEmailListResponse(first);

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

    if (!skipLive) {
      try {
        const message = await getGmailMessageById(
          db,
          c.env,
          user.id,
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
            .where(and(eq(emails.userId, user.id), eq(emails.id, Number(emailId))));
        }

        attachments = messageAttachments.map((attachment) => {
          const downloadUrl = buildAttachmentUrl({
            gmailMessageId: baseEmail.gmailId,
            attachmentId: attachment.attachmentId,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
          });
          const inlineUrl = attachment.isInline
            ? buildAttachmentUrl({
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
            emailId,
            gmailId: baseEmail.gmailId,
          });
        } else {
          console.error("Failed to fetch live Gmail detail for email", {
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
