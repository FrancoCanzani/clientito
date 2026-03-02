import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { getGmailAttachmentBytes } from "../../lib/gmail";
import type { AppRouteEnv } from "../types";
import { emailAttachmentQuerySchema, errorResponseSchema } from "./schemas";

const getEmailAttachmentRoute = createRoute({
  method: "get",
  path: "/attachment",
  tags: ["emails"],
  request: {
    query: emailAttachmentQuerySchema,
  },
  responses: {
    200: {
      description: "Attachment data",
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

function normalizeMimeType(input: string | undefined): string {
  if (!input) {
    return "application/octet-stream";
  }

  const normalized = input.trim().toLowerCase();
  return normalized.includes("/") ? normalized : "application/octet-stream";
}

function normalizeFilename(input: string | undefined): string | null {
  if (!input) {
    return null;
  }

  const normalized = input.replace(/[\r\n]/g, "").trim();
  return normalized.length > 0 ? normalized : null;
}

export function registerGetEmailAttachment(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(getEmailAttachmentRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { gmailMessageId, attachmentId, filename, mimeType, inline } =
      c.req.valid("query");

    try {
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

      return new Response(bytes, {
        status: 200,
        headers,
      });
    } catch (error) {
      console.error("Failed to download Gmail attachment", {
        gmailMessageId,
        attachmentId,
        error,
      });
      return c.json({ error: "Attachment not found" }, 404);
    }
  });
}
