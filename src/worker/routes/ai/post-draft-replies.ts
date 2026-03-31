import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
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

    const result: Record<number, string> = {};
    const settled = await Promise.allSettled(
      emailIds.map((emailId) =>
          generateDraftForEmail({
            db,
            env: c.env,
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

    return c.json({ data: result }, 200);
  });
}
