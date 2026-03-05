import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import type { AppRouteEnv } from "../types";
import { noteImageQuerySchema } from "./schemas";

function notesImagesBucket(env: Env): R2Bucket {
  return (env as Env & { NOTES_IMAGES: R2Bucket }).NOTES_IMAGES;
}

export function registerGetNoteImage(api: Hono<AppRouteEnv>) {
  return api.get("/image", zValidator("query", noteImageQuerySchema), async (c) => {
    const user = c.get("user")!;
    const { key } = c.req.valid("query");

    if (!key.startsWith(`${user.id}/`)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const bucket = notesImagesBucket(c.env);
    const object = await bucket.get(key);
    if (!object || !object.body) {
      return c.json({ error: "Image not found" }, 404);
    }

    const headers = new Headers();
    headers.set("Cache-Control", "private, max-age=604800");
    headers.set(
      "Content-Type",
      object.httpMetadata?.contentType ?? "application/octet-stream",
    );
    return new Response(object.body, { status: 200, headers });
  });
}
