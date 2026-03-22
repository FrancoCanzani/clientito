import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { emails } from "../../../db/schema";
import { createEmailProvider } from "../../../lib/email";
import type { AppRouteEnv } from "../../types";
import { normalizeFilename, normalizeMimeType } from "./utils";
import { emailAttachmentQuerySchema } from "./schemas";

export function registerGetAttachment(api: Hono<AppRouteEnv>) {
  api.get(
    "/attachment",
    zValidator("query", emailAttachmentQuerySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;

      const { providerMessageId, attachmentId, filename, mimeType, inline } =
        c.req.valid("query");

      const emailRow = await db
        .select({ mailboxId: emails.mailboxId })
        .from(emails)
        .where(and(eq(emails.userId, user.id), eq(emails.providerMessageId, providerMessageId)))
        .limit(1);
      const mailboxId = emailRow[0]?.mailboxId;
      if (!mailboxId) {
        return c.json({ error: "Email not found" }, 404);
      }

      let reconnectRequired = false;

      try {
        const provider = await createEmailProvider(db, c.env, mailboxId);
        const bytes = await provider.fetchAttachment(
          providerMessageId,
          attachmentId,
        );

        const safeFilename = normalizeFilename(filename);
        const headers = new Headers();
        headers.set("Content-Type", normalizeMimeType(mimeType));
        headers.set("Cache-Control", "private, max-age=300");

        if (safeFilename) {
          const dispositionType = inline ? "inline" : "attachment";
          headers.set(
            "Content-Disposition",
            `${dispositionType}; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
          );
        }

        return new Response(bytes, { status: 200, headers });
      } catch (error) {
        console.error("Failed to download attachment", {
          providerMessageId,
          attachmentId,
          error,
        });

        try {
          const provider = await createEmailProvider(db, c.env, mailboxId);
          reconnectRequired = provider.isReconnectError(error);
        } catch {
          reconnectRequired = false;
        }

        if (reconnectRequired) {
          return c.json(
            { error: "Provider connection expired. Sign in again." },
            401,
          );
        }

        if (
          error instanceof Error &&
          error.message.startsWith("Gmail request failed (404)")
        ) {
          return c.json({ error: "Attachment not found." }, 404);
        }

        return c.json({ error: "Failed to download attachment." }, 500);
      }
    },
  );
}
