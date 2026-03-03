import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { emails } from "../../db/schema";
import { isGmailReconnectRequiredError } from "../../lib/gmail/errors";
import {
  extractMessageAttachments,
  extractMessageBodyHtml,
  extractMessageBodyText,
  getGmailMessageById,
} from "../../lib/gmail/message";
import { createTimer } from "../../lib/timing";
import type { AppRouteEnv } from "../types";
import {
  buildAttachmentUrl,
  HAS_ATTACHMENT_LABEL,
  resolveInlineCidImages,
  toEmailListResponse,
} from "./helpers";
import {
  emailDetailParamsSchema,
  emailDetailQuerySchema,
  emailDetailResponseSchema,
  errorResponseSchema,
} from "./schemas";

const getEmailRoute = createRoute({
  method: "get",
  path: "/:emailId",
  tags: ["emails"],
  request: {
    params: emailDetailParamsSchema,
    query: emailDetailQuerySchema,
  },
  responses: {
    200: {
      content: { "application/json": { schema: emailDetailResponseSchema } },
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

export function registerGetEmail(api: OpenAPIHono<AppRouteEnv>) {
  api.openapi(getEmailRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const timer = createTimer("emails-detail", { userId: user.id });

    const { emailId } = c.req.valid("param");
    const { refreshLive } = c.req.valid("query");
    timer.mark("query-validated");

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
      .where(and(eq(emails.userId, user.id), eq(emails.id, emailId)))
      .limit(1);
    timer.mark("db-row");

    const first = row[0];
    if (!first) return c.json({ error: "Email not found" }, 404);

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

    const shouldFetchLive = refreshLive === true;

    if (shouldFetchLive) {
      try {
        timer.mark("live-start");
        const message = await getGmailMessageById(
          db,
          c.env,
          user.id,
          baseEmail.gmailId,
        );
        timer.mark("live-fetched");

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

        if (hasLiveAttachments && !baseEmail.labelIds.includes(HAS_ATTACHMENT_LABEL)) {
          const nextLabelIds = [...baseEmail.labelIds, HAS_ATTACHMENT_LABEL];
          baseEmail.labelIds = nextLabelIds;
          baseEmail.hasAttachment = true;
          await db
            .update(emails)
            .set({ labelIds: nextLabelIds })
            .where(and(eq(emails.userId, user.id), eq(emails.id, emailId)));
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

          return { ...attachment, downloadUrl, inlineUrl };
        });
        timer.mark("live-processed");
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

    timer.end({
      emailId,
      refreshLive,
      attachmentCount: attachments.length,
    });
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
