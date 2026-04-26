import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";
import { resolveMailbox } from "../../lib/gmail/mailboxes";
import type { AppRouteEnv } from "../types";

const grammarCheckBodySchema = z.object({
  mailboxId: z.number().int().positive(),
  text: z.string().trim().min(1).max(20000),
});

const GRAMMAR_SYSTEM = [
  "You are a grammar and spelling assistant.",
  "Fix grammar, spelling, and punctuation errors in the given text.",
  "Preserve the original tone, meaning, and style.",
  "Do not add or remove sentences. Do not rephrase unless necessary for correctness.",
  "Output ONLY the corrected text. No explanations, no markdown, no labels.",
  "If the text has no errors, return it unchanged.",
].join(" ");

export function registerPostGrammarCheck(app: Hono<AppRouteEnv>) {
  app.post(
    "/grammar-check",
    zValidator("json", grammarCheckBodySchema),
    async (c) => {
      const { mailboxId, text } = c.req.valid("json");
      const db = c.get("db");
      const user = c.get("user")!;
      const mailbox = await resolveMailbox(db, user.id, mailboxId);
      if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);
      if (!mailbox.aiEnabled) {
        return c.json({ error: "AI features are disabled for this mailbox" }, 403);
      }
      const openai = createOpenAI({ apiKey: c.env.OPENAI_API_KEY });
      try {
        const result = await generateText({
          model: openai.responses("gpt-5.4-mini"),
          system: GRAMMAR_SYSTEM,
          prompt: text,
          maxOutputTokens: 4000,
        });

        return c.json({ corrected: result.text.trim() }, 200);
      } catch (error) {
        console.error("Grammar check failed", { model: "gpt-5.4-mini", error });
        return c.json({ error: "Grammar check unavailable" }, 503 as never);
      }
    },
  );
}
