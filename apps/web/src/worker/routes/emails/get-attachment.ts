import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { getGmailAttachmentBytes } from "../../lib/gmail/message";
import { createTimer } from "../../lib/timing";
import type { AppRouteEnv } from "../types";
import { normalizeFilename, normalizeMimeType } from "./helpers";
import { emailAttachmentQuerySchema, errorResponseSchema } from "./schemas";

const getEmailAttachmentRoute = createRoute({
  method: "get",
  path: "/attachment",
  tags: ["emails"],
  request: { query: emailAttachmentQuerySchema },
  responses: {
    200: { description: "Attachment data" },
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

export function registerGetAttachment(api: OpenAPIHono<AppRouteEnv>) {
  api.openapi(getEmailAttachmentRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const timer = createTimer("emails-attachment", { userId: user.id });

    const { gmailMessageId, attachmentId, filename, mimeType, inline } =
      c.req.valid("query");
    timer.mark("query-validated");

    try {
      const bytes = await getGmailAttachmentBytes(
        db,
        c.env,
        user.id,
        gmailMessageId,
        attachmentId,
      );
      timer.mark("bytes-fetched");

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

      timer.end({
        gmailMessageId,
        attachmentId,
        bytesLength: bytes.length,
      });
      return new Response(bytes, { status: 200, headers });
    } catch (error) {
      console.error("Failed to download Gmail attachment", {
        gmailMessageId,
        attachmentId,
        error,
      });
      timer.end({ gmailMessageId, attachmentId, failed: true });
      return c.json({ error: "Attachment not found" }, 404);
    }
  });
}
