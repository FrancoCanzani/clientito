import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import type { AppRouteEnv } from "../types";

const grammarCheckBodySchema = z.object({
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
      const { text } = c.req.valid("json");

      const openai = createOpenAI({ apiKey: c.env.OPENAI_API_KEY });
      const result = await generateText({
        model: openai("gpt-5.4-mini"),
        system: GRAMMAR_SYSTEM,
        prompt: text,
        maxOutputTokens: 4000,
      });

      return c.json({ data: { corrected: result.text.trim() } }, 200);
    },
  );
}
