import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { emails } from "../../../db/schema";
import { GmailDriver } from "../../../lib/gmail/driver";
import { catchUpAllMailboxes } from "../../../lib/gmail/sync/engine";
import type { AppRouteEnv } from "../../types";
import { emailDetailParamsSchema, emailDetailQuerySchema } from "./schemas";
import {
  buildAttachmentUrl,
  emailSummarySelection,
  HAS_ATTACHMENT_LABEL,
  resolveInlineCidImages,
  toEmailListResponse,
} from "./utils";

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

      c.executionCtx.waitUntil(
        catchUpAllMailboxes(db, c.env, user.id).catch((err) => {
          console.error("Background sync failed (email detail)", err);
        }),
      );

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

      const baseEmail = {
        ...toEmailListResponse(first),
        bodyText: first.bodyText,
        bodyHtml: first.bodyHtml,
      };
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

      if (shouldFetchLive && first.mailboxId) {
        let reconnectRequired = false;

        try {
          const provider = new GmailDriver(db, c.env, first.mailboxId);
          const rawMessage = await provider.fetchMessage(
            baseEmail.providerMessageId,
          );

          resolvedBodyText = rawMessage.bodyText ?? resolvedBodyText;
          resolvedBodyHtml = rawMessage.bodyHtml ?? resolvedBodyHtml;
          if (resolvedBodyHtml) {
            resolvedBodyHtml = resolveInlineCidImages(
              resolvedBodyHtml,
              baseEmail.providerMessageId,
              rawMessage.attachments,
            );
          }

          const hasLiveAttachments = rawMessage.attachments.length > 0;
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

          attachments = rawMessage.attachments.map((attachment) => {
            const downloadUrl = buildAttachmentUrl({
              providerMessageId: baseEmail.providerMessageId,
              attachmentId: attachment.attachmentId,
              filename: attachment.filename,
              mimeType: attachment.mimeType,
            });
            const inlineUrl = attachment.isInline
              ? buildAttachmentUrl({
                  providerMessageId: baseEmail.providerMessageId,
                  attachmentId: attachment.attachmentId,
                  filename: attachment.filename,
                  mimeType: attachment.mimeType,
                  inline: true,
                })
              : null;

            return { ...attachment, downloadUrl, inlineUrl };
          });
        } catch (error) {
          try {
            const provider = new GmailDriver(db, c.env, first.mailboxId);
            reconnectRequired = provider.isReconnectError(error);
          } catch {
            reconnectRequired = false;
          }

          if (reconnectRequired) {
            console.warn("Live detail skipped: reconnect required", {
              emailId,
              providerMessageId: baseEmail.providerMessageId,
            });
          } else {
            console.error("Failed to fetch live detail for email", {
              emailId,
              providerMessageId: baseEmail.providerMessageId,
              error,
            });
          }
        }
      }

      return c.json(
        {
          ...baseEmail,
          resolvedBodyText,
          resolvedBodyHtml,
          attachments,
        },
        200,
      );
    },
  );
}
