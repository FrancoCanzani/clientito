import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { briefingDecisions } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { generateDraftForEmail } from "./post-draft-reply";

const MAX_BATCH_SIZE = 5;

const draftRepliesBodySchema = z.object({
  emailIds: z.array(z.number().int().positive()).min(1).max(MAX_BATCH_SIZE),
});

export function registerPostDraftReplies(app: Hono<AppRouteEnv>) {
  app.post("/draft-replies", zValidator("json", draftRepliesBodySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const { emailIds } = c.req.valid("json");

    const cached = await db
      .select({
        referenceId: briefingDecisions.referenceId,
        draftReply: briefingDecisions.draftReply,
      })
      .from(briefingDecisions)
      .where(
        and(
          eq(briefingDecisions.userId, user.id),
          eq(briefingDecisions.itemType, "email"),
          inArray(briefingDecisions.referenceId, emailIds),
        ),
      );

    const result: Record<number, string> = {};
    const cachedMap = new Map(cached.map((r) => [r.referenceId, r.draftReply]));
    const needsGeneration = emailIds.filter(
      (id) => !cachedMap.has(id) || !cachedMap.get(id),
    );

    for (const [id, draft] of cachedMap) {
      if (draft) result[id] = draft;
    }

    if (needsGeneration.length > 0) {
      const settled = await Promise.allSettled(
        needsGeneration.map((emailId) =>
          generateDraftForEmail({
            db,
            ai: c.env.AI,
            userId: user.id,
            emailId,
          }).then((draft) => ({ emailId, draft })),
        ),
      );

      for (const entry of settled) {
        if (entry.status === "fulfilled" && entry.value.draft) {
          result[entry.value.emailId] = entry.value.draft;
        }
      }
    }

    return c.json({ data: result }, 200);
  });
}
