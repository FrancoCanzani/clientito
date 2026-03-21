import type { Hono } from "hono";
import type { AppRouteEnv } from "../types";

const MAX_FILES = 10;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB (Gmail limit)

export function registerUploadAttachments(api: Hono<AppRouteEnv>) {
  api.post("/attachments", async (c) => {
    const user = c.get("user")!;
    const env = c.env;

    const formData = await c.req.formData();
    const files: File[] = [];
    for (const [, value] of formData.entries()) {
      if (value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return c.json({ error: "No files provided" }, 400);
    }

    if (files.length > MAX_FILES) {
      return c.json({ error: `Too many files (max ${MAX_FILES})` }, 400);
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return c.json({ error: `File "${file.name}" exceeds 25 MB limit` }, 400);
      }
    }

    const results: Array<{
      key: string;
      filename: string;
      mimeType: string;
      size: number;
    }> = [];

    for (const file of files) {
      const uuid = crypto.randomUUID();
      const key = `attachments/${user.id}/${uuid}/${file.name}`;
      await env.ATTACHMENTS.put(key, file.stream(), {
        httpMetadata: {
          contentType: file.type || "application/octet-stream",
        },
      });
      results.push({
        key,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      });
    }

    return c.json({ data: results }, 200);
  });
}
