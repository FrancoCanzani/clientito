import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { emails } from "../../db/schema";
import { isGmailReconnectRequiredError } from "../../lib/gmail/errors";
import {
  extractMessageAttachments,
  extractMessageBodyHtml,
  extractMessageBodyText,
  getGmailMessageById,
} from "../../lib/gmail/mailbox";
import type { AppRouteEnv } from "../types";
import {
  buildAttachmentUrl,
  emailSummarySelection,
  HAS_ATTACHMENT_LABEL,
  resolveInlineCidImages,
  toEmailDetailResponse,
} from "./helpers";
import { emailDetailParamsSchema, emailDetailQuerySchema } from "./schemas";

export function registerGetEmail(api: Hono<AppRouteEnv>) {
  api.get(
    "/:emailId",
    zValidator("param", emailDetailParamsSchema),
    zValidator("query", emailDetailQuerySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;

      const { emailId } = c.req.valid("param");
      const { refreshLive } = c.req.valid("query");

      const row = await db
        .select({
          ...emailSummarySelection,
          bodyText: emails.bodyText,
          bodyHtml: emails.bodyHtml,
        })
        .from(emails)
        .where(and(eq(emails.userId, user.id), eq(emails.id, emailId)))
        .limit(1);

      const first = row[0];
      if (!first) return c.json({ error: "Email not found" }, 404);

      const baseEmail = toEmailDetailResponse(first);
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
    },
  );
}
