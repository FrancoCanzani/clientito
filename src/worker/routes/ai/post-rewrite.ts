import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";
import type { AppRouteEnv } from "../types";

const rewriteBodySchema = z.object({
  text: z.string().trim().min(1).max(20000),
  instruction: z.enum([
    "improve",
    "formal",
    "casual",
    "shorten",
  ]),
});

const INSTRUCTIONS: Record<z.infer<typeof rewriteBodySchema>["instruction"], string> = {
  improve:
    "Improve the clarity, flow, and readability of the given text. Fix any errors. Keep the original meaning and tone. Output ONLY the rewritten text.",
  formal:
    "Rewrite the given text in a formal, professional tone. Keep the original meaning. Output ONLY the rewritten text.",
  casual:
    "Rewrite the given text in a casual, friendly tone. Keep the original meaning. Output ONLY the rewritten text.",
  shorten:
    "Make the given text more concise without losing its meaning. Remove filler words and unnecessary phrases. Output ONLY the rewritten text.",
};

export function registerPostRewrite(app: Hono<AppRouteEnv>) {
  app.post(
    "/rewrite",
    zValidator("json", rewriteBodySchema),
    async (c) => {
      const { text, instruction } = c.req.valid("json");
      const openai = createOpenAI({ apiKey: c.env.OPENAI_API_KEY });

      try {
        const result = await generateText({
          model: openai.responses("gpt-5.4-mini"),
          system: INSTRUCTIONS[instruction],
          prompt: text,
          maxOutputTokens: 4000,
        });

        return c.json({ rewritten: result.text.trim() }, 200);
      } catch (error) {
        console.error("Rewrite failed", { instruction, error });
        return c.json({ error: "Rewrite unavailable" }, 503 as never);
      }
    },
  );
}
