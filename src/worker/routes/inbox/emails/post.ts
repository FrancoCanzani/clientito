import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { createEmailProvider } from "../../../lib/email";
import { resolveOutgoingMailbox } from "../../../lib/email/mailbox-state";
import { sleep } from "../../../lib/utils";
import { and, eq } from "drizzle-orm";
import { emails } from "../../../db/schema";
import type { Database } from "../../../db/client";
import type { AppRouteEnv } from "../../types";
import { sendEmailBodySchema } from "./schemas";
import {
  deleteAttachmentFile,
  getAttachmentContent,
} from "./internal/storage";

const SENT_EMAIL_PROJECTION_RETRIES = 3;
const SENT_EMAIL_PROJECTION_DELAY_MS = 300;

async function projectSentEmail(
  db: Database,
  env: Env,
  mailboxId: number,
  userId: string,
  providerMessageId: string,
): Promise<boolean> {
  const provider = await createEmailProvider(db, env, mailboxId);

  for (let attempt = 0; attempt < SENT_EMAIL_PROJECTION_RETRIES; attempt += 1) {
    try {
      await provider.syncMessageIds(userId, [providerMessageId], true);
    } catch (error) {
      console.warn("Sent email projection attempt failed", {
        userId,
        mailboxId,
        providerMessageId,
        attempt: attempt + 1,
        error,
      });
    }

    const row = await db
      .select({ id: emails.id })
      .from(emails)
      .where(and(eq(emails.userId, userId), eq(emails.providerMessageId, providerMessageId)))
      .limit(1);

    if (row[0]) {
      return true;
    }

    if (attempt < SENT_EMAIL_PROJECTION_RETRIES - 1) {
      await sleep(SENT_EMAIL_PROJECTION_DELAY_MS * (attempt + 1));
    }
  }

  return false;
}

export function registerPostEmail(api: Hono<AppRouteEnv>) {
  api.post("/send", zValidator("json", sendEmailBodySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const env = c.env;

    const input = c.req.valid("json");

    let mailbox;
    try {
      mailbox = await resolveOutgoingMailbox(db, user.id, input.mailboxId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to resolve sender account";
      const status = message === "Selected sender account not found." ? 404 : 400;
      return c.json({ error: message }, status);
    }

    try {
      let attachments:
        | Array<{ filename: string; mimeType: string; content: ArrayBuffer }>
        | undefined;

      if (input.attachments && input.attachments.length > 0) {
        attachments = await Promise.all(
          input.attachments.map(async (att) => ({
            filename: att.filename,
            mimeType: att.mimeType,
            content: await getAttachmentContent(env, att.key),
          })),
        );
      }

      const provider = await createEmailProvider(db, env, mailbox.id);
      const result = await provider.send(
        mailbox.email ?? user.email,
        {
          to: input.to,
          cc: input.cc,
          bcc: input.bcc,
          subject: input.subject,
          body: input.body,
          inReplyTo: input.inReplyTo,
          references: input.references,
          threadId: input.threadId,
          attachments,
        },
      );

      const projected = await projectSentEmail(
        db,
        env,
        mailbox.id,
        user.id,
        result.providerMessageId,
      );

      if (!projected) {
        console.warn("Sent email was not projected into D1 immediately", {
          userId: user.id,
          providerMessageId: result.providerMessageId,
        });
      }

      if (input.attachments) {
        await Promise.allSettled(
          input.attachments.map((att) => deleteAttachmentFile(env, att.key)),
        );
      }

      return c.json(
        {
          data: {
            providerMessageId: result.providerMessageId,
            threadId: result.threadId,
            projected,
          },
        },
        200,
      );
    } catch (error) {
      console.error("Failed to send email", { userId: user.id, error });
      return c.json(
        {
          error: error instanceof Error ? error.message : "Failed to send email",
        },
        500,
      );
    }
  });
}
