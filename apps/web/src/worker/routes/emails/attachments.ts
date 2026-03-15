import type { Hono } from "hono";
import type { AppRouteEnv } from "../types";

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
