import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { isGmailReconnectRequiredError } from "../../lib/gmail/errors";
import { getGmailAttachmentBytes } from "../../lib/gmail/message";
import type { AppRouteEnv } from "../types";
import { normalizeFilename, normalizeMimeType } from "./helpers";
import { emailAttachmentQuerySchema } from "./schemas";

export function registerGetAttachment(api: Hono<AppRouteEnv>) {
  api.get(
    "/attachment",
    zValidator("query", emailAttachmentQuerySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;

      const { gmailMessageId, attachmentId, filename, mimeType, inline } =
        c.req.valid("query");

      try {
        // getGmailAttachmentBytes() refreshes the Gmail access token when needed.
        const bytes = await getGmailAttachmentBytes(
          db,
          c.env,
          user.id,
          gmailMessageId,
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
        console.error("Failed to download Gmail attachment", {
          gmailMessageId,
          attachmentId,
          error,
        });

        if (isGmailReconnectRequiredError(error)) {
          return c.json(
            { error: "Google connection expired. Sign in with Google again." },
            401,
          );
        }

        if (
          error instanceof Error &&
          error.message.startsWith("Gmail request failed (404)")
        ) {
          return c.json({ error: "Attachment not found in Gmail." }, 404);
        }

        return c.json({ error: "Failed to download attachment." }, 500);
      }
    },
  );
}
