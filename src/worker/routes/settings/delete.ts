import type { Hono } from "hono";
import { eq } from "drizzle-orm";
import { user } from "../../db/auth-schema";
import type { AppRouteEnv } from "../types";

const ATTACHMENT_LIST_LIMIT = 1000;

async function deleteUserAttachments(env: AppRouteEnv["Bindings"], userId: string) {
  const prefix = `attachments/${userId}/`;
  let cursor: string | undefined;

  do {
    const listed = await env.ATTACHMENTS.list({
      prefix,
      cursor,
      limit: ATTACHMENT_LIST_LIMIT,
    });
    if (listed.objects.length > 0) {
      await Promise.all(
        listed.objects.map((object) => env.ATTACHMENTS.delete(object.key)),
      );
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

export function registerDeleteAccount(api: Hono<AppRouteEnv>) {
  api.delete("/account", async (c) => {
    const db = c.get("db");
    const currentUser = c.get("user")!;

    try {
      await deleteUserAttachments(c.env, currentUser.id);
      await db.delete(user).where(eq(user.id, currentUser.id));
      return c.json({ data: { deleted: true } }, 200);
    } catch {
      return c.json({ error: "Failed to delete account" }, 500);
    }
  });
}
