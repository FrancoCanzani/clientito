import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { runGrammarCheck } from "../../lib/ai/grammar-check";
import { resolveMailbox } from "../../lib/gmail/mailboxes";
import { getUser } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { handleAiRouteError } from "./utils";

const grammarCheckBodySchema = z.object({
  mailboxId: z.number().int().positive(),
  text: z.string().trim().min(1).max(20000),
});

export function registerPostGrammarCheck(app: Hono<AppRouteEnv>) {
  app.post(
    "/grammar-check",
    zValidator("json", grammarCheckBodySchema),
    async (c) => {
      const { mailboxId, text } = c.req.valid("json");
      const db = c.get("db");
      const user = getUser(c);
      const mailbox = await resolveMailbox(db, user.id, mailboxId);
      if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

      try {
        const corrected = await runGrammarCheck({
          env: c.env,
          db,
          userId: user.id,
          mailbox,
          text,
        });
        return c.json({ corrected }, 200);
      } catch (error) {
        return handleAiRouteError(c, error, "Grammar check unavailable");
      }
    },
  );
}
