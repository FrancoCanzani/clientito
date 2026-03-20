import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { drafts } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { draftParamsSchema } from "./schemas";

export function registerDeleteDraft(api: Hono<AppRouteEnv>) {
  api.delete("/:id", zValidator("param", draftParamsSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const { id } = c.req.valid("param");

    await db
      .delete(drafts)
      .where(and(eq(drafts.id, id), eq(drafts.userId, user.id)));

    return c.json({ success: true }, 200);
  });
}
