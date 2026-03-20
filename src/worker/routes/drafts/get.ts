import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { drafts } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { draftParamsSchema } from "./schemas";

export function registerGetDraft(api: Hono<AppRouteEnv>) {
  api.get("/:id", zValidator("param", draftParamsSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const { id } = c.req.valid("param");

    const row = await db
      .select()
      .from(drafts)
      .where(and(eq(drafts.id, id), eq(drafts.userId, user.id)))
      .limit(1);

    if (!row[0]) {
      return c.json({ error: "Draft not found" }, 404);
    }

    return c.json({ data: row[0] }, 200);
  });
}
