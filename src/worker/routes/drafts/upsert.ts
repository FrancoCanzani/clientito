import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { drafts } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { draftBodySchema, draftParamsSchema } from "./schemas";

export function registerUpsertDraft(api: Hono<AppRouteEnv>) {
  // Create
  api.post("/", zValidator("json", draftBodySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const input = c.req.valid("json");
    const now = Date.now();

    const row = await db
      .insert(drafts)
      .values({
        userId: user.id,
        to: input.to ?? null,
        cc: input.cc ?? null,
        subject: input.subject ?? null,
        body: input.body ?? null,
        inReplyTo: input.inReplyTo ?? null,
        threadId: input.threadId ?? null,
        updatedAt: now,
        createdAt: now,
      })
      .returning();

    return c.json({ data: row[0] }, 201);
  });

  // Update
  api.put("/:id", zValidator("param", draftParamsSchema), zValidator("json", draftBodySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const now = Date.now();

    const row = await db
      .update(drafts)
      .set({
        to: input.to ?? null,
        cc: input.cc ?? null,
        subject: input.subject ?? null,
        body: input.body ?? null,
        inReplyTo: input.inReplyTo ?? null,
        threadId: input.threadId ?? null,
        updatedAt: now,
      })
      .where(and(eq(drafts.id, id), eq(drafts.userId, user.id)))
      .returning();

    if (!row[0]) {
      return c.json({ error: "Draft not found" }, 404);
    }

    return c.json({ data: row[0] }, 200);
  });
}
