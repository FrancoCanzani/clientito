import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { drafts } from "../../../db/schema";
import type { AppRouteEnv } from "../../types";
import { getUser } from "../../../middleware/auth";
import { upsertDraftBodySchema } from "./schemas";

export function registerPostDrafts(api: Hono<AppRouteEnv>) {
  return api.post("/", zValidator("json", upsertDraftBodySchema), async (c) => {
    const db = c.get("db");
    const user = getUser(c);
    const body = c.req.valid("json");
    const now = Date.now();

    const existing = await db
      .select({ id: drafts.id })
      .from(drafts)
      .where(
        and(eq(drafts.userId, user.id), eq(drafts.composeKey, body.composeKey)),
      )
      .limit(1);

    if (existing[0]) {
      const [updated] = await db
        .update(drafts)
        .set({
          mailboxId: body.mailboxId ?? null,
          toAddr: body.toAddr,
          ccAddr: body.ccAddr,
          bccAddr: body.bccAddr,
          subject: body.subject,
          body: body.body,
          forwardedContent: body.forwardedContent,
          threadId: body.threadId ?? null,
          attachmentKeys: body.attachmentKeys ?? null,
          updatedAt: now,
        })
        .where(eq(drafts.id, existing[0].id))
        .returning();

      const { userId: _userId, ...row } = updated!;
      return c.json(row, 200);
    }

    const [inserted] = await db
      .insert(drafts)
      .values({
        userId: user.id,
        composeKey: body.composeKey,
        mailboxId: body.mailboxId ?? null,
        toAddr: body.toAddr,
        ccAddr: body.ccAddr,
        bccAddr: body.bccAddr,
        subject: body.subject,
        body: body.body,
        forwardedContent: body.forwardedContent,
        threadId: body.threadId ?? null,
        attachmentKeys: body.attachmentKeys ?? null,
        updatedAt: now,
        createdAt: now,
      })
      .returning();

    const { userId: _userId, ...row } = inserted!;
    return c.json(row, 201);
  });
}
