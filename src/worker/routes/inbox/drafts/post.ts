import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { drafts } from "../../../db/schema";
import type { AppRouteEnv } from "../../types";
import { upsertDraftBodySchema } from "./schemas";
import { DRAFT_COLUMNS } from "./utils";

export function registerPostDrafts(api: Hono<AppRouteEnv>) {
  return api.post("/", zValidator("json", upsertDraftBodySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
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
      await db
        .update(drafts)
        .set({
          mailboxId: body.mailboxId ?? null,
          toAddr: body.to,
          ccAddr: body.cc,
          bccAddr: body.bcc,
          subject: body.subject,
          body: body.body,
          forwardedContent: body.forwardedContent,
          threadId: body.threadId ?? null,
          attachmentKeys: body.attachmentKeys ?? null,
          updatedAt: now,
        })
        .where(eq(drafts.id, existing[0].id));

      const rows = await db
        .select(DRAFT_COLUMNS)
        .from(drafts)
        .where(eq(drafts.id, existing[0].id))
        .limit(1);

      return c.json({ data: rows[0]! }, 200);
    }

    const inserted = await db
      .insert(drafts)
      .values({
        userId: user.id,
        composeKey: body.composeKey,
        mailboxId: body.mailboxId ?? null,
        toAddr: body.to,
        ccAddr: body.cc,
        bccAddr: body.bcc,
        subject: body.subject,
        body: body.body,
        forwardedContent: body.forwardedContent,
        threadId: body.threadId ?? null,
        attachmentKeys: body.attachmentKeys ?? null,
        updatedAt: now,
        createdAt: now,
      })
      .returning({ id: drafts.id });

    const rows = await db
      .select(DRAFT_COLUMNS)
      .from(drafts)
      .where(eq(drafts.id, inserted[0]!.id))
      .limit(1);

    return c.json({ data: rows[0]! }, 201);
  });
}
