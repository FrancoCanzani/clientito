import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { runRewrite } from "../../lib/ai/rewrite";
import { resolveMailbox } from "../../lib/gmail/mailboxes";
import { getUser } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { handleAiRouteError } from "./utils";

const rewriteBodySchema = z.object({
  mailboxId: z.number().int().positive(),
  text: z.string().trim().min(1).max(20000),
  instruction: z.enum(["improve", "formal", "casual", "shorten"]),
});

export function registerPostRewrite(app: Hono<AppRouteEnv>) {
  app.post(
    "/rewrite",
    zValidator("json", rewriteBodySchema),
    async (c) => {
      const { mailboxId, text, instruction } = c.req.valid("json");
      const db = c.get("db");
      const user = getUser(c);
      const mailbox = await resolveMailbox(db, user.id, mailboxId);
      if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

      try {
        const rewritten = await runRewrite({
          env: c.env,
          db,
          userId: user.id,
          mailbox,
          text,
          instruction,
        });
        return c.json({ rewritten }, 200);
      } catch (error) {
        return handleAiRouteError(c, error, "Rewrite unavailable");
      }
    },
  );
}
