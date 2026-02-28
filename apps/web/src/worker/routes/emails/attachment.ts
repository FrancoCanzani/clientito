import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { ensureOrgAccess } from "../../lib/access";
import { getGmailAttachmentBytes } from "../../lib/gmail";
import { syncState } from "../../db/schema";
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
    403: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Forbidden",
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

    const { orgId, gmailMessageId, attachmentId, filename, mimeType, inline } =
      c.req.valid("query");
    if (!(await ensureOrgAccess(db, orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const orgSyncState = await db.query.syncState.findFirst({
      where: eq(syncState.orgId, orgId),
    });
    const gmailUserId = orgSyncState?.userId ?? user.id;

    try {
      const bytes = await getGmailAttachmentBytes(
        db,
        c.env,
        gmailUserId,
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
        orgId,
        gmailMessageId,
        attachmentId,
        error,
      });
      return c.json({ error: "Attachment not found" }, 404);
    }
  });
}
