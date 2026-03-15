import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import type { Database } from "../../db/client";
import { emails } from "../../db/schema";
import { sleep } from "../../lib/gmail/api";
import { sendGmailMessage, fetchAttachmentFromR2 } from "../../lib/gmail/send";
import { syncGmailMessageIds } from "../../lib/gmail/sync";
import type { AppRouteEnv } from "../types";
import { sendEmailBodySchema } from "./schemas";

const SENT_EMAIL_PROJECTION_RETRIES = 3;
const SENT_EMAIL_PROJECTION_DELAY_MS = 300;

async function projectSentEmail(
  db: Database,
  env: Env,
  userId: string,
  gmailId: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < SENT_EMAIL_PROJECTION_RETRIES; attempt += 1) {
    try {
      await syncGmailMessageIds(db, env, userId, [gmailId], true);
    } catch (error) {
      console.warn("Sent email projection attempt failed", {
        userId,
        gmailId,
        attempt: attempt + 1,
        error,
      });
    }

    const row = await db
      .select({ id: emails.id })
      .from(emails)
      .where(and(eq(emails.userId, userId), eq(emails.gmailId, gmailId)))
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

    try {
      let attachments:
        | Array<{ filename: string; mimeType: string; content: ArrayBuffer }>
        | undefined;

      if (input.attachments && input.attachments.length > 0) {
        attachments = await Promise.all(
          input.attachments.map(async (att) => ({
            filename: att.filename,
            mimeType: att.mimeType,
            content: await fetchAttachmentFromR2(env, att.key),
          })),
        );
      }

      const result = await sendGmailMessage(db, env, user.id, user.email, {
        to: input.to,
        subject: input.subject,
        body: input.body,
        inReplyTo: input.inReplyTo,
        references: input.references,
        threadId: input.threadId,
        attachments,
      });

      const projected = await projectSentEmail(
        db,
        env,
        user.id,
        result.gmailId,
      );

      if (!projected) {
        console.warn("Sent email was not projected into D1 immediately", {
          userId: user.id,
          gmailId: result.gmailId,
        });
      }

      // Cleanup R2 objects after successful send
      if (input.attachments) {
        await Promise.allSettled(
          input.attachments.map((att) => env.ATTACHMENTS.delete(att.key)),
        );
      }

      return c.json(
        {
          data: {
            gmailId: result.gmailId,
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
