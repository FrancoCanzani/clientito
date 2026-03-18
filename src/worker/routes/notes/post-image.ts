import type { Hono } from "hono";
import type { AppRouteEnv } from "../types";

function extensionFromMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "bin";
}

function notesImagesBucket(env: Env): R2Bucket {
  return (env as Env & { NOTES_IMAGES: R2Bucket }).NOTES_IMAGES;
}

export function registerPostNoteImage(api: Hono<AppRouteEnv>) {
  return api.post("/image", async (c) => {
    const user = c.get("user")!;
    const formData = await c.req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return c.json({ error: "Image file is required" }, 400);
    }
    if (!file.type.startsWith("image/")) {
      return c.json({ error: "Only image uploads are supported" }, 400);
    }
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: "Image must be 10MB or smaller" }, 400);
    }

    const key = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${extensionFromMimeType(file.type)}`;
    const bucket = notesImagesBucket(c.env);
    const body = await file.arrayBuffer();
    await bucket.put(key, body, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    const url = `/api/notes/image?key=${encodeURIComponent(key)}`;
    return c.json({ data: { key, url } }, 201);
  });
}
