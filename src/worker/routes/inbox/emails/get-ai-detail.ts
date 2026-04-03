import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { Hono } from "hono";
import { emails } from "../../../db/schema";
import {
  getEmailDetailCached,
  getOrGenerateSummary,
  saveSummary,
  SUMMARY_SYSTEM,
} from "../../../lib/email/intelligence/detail";
import { EMAIL_INTELLIGENCE_MODEL } from "../../../lib/email/intelligence/common";
import type { AppRouteEnv } from "../../types";
import { emailDetailParamsSchema } from "./schemas";

export function registerGetEmailAIDetail(api: Hono<AppRouteEnv>) {
  api.get(
    "/:emailId/ai",
    zValidator("param", emailDetailParamsSchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { emailId } = c.req.valid("param");

      const emailRow = await db
        .select({ id: emails.id })
        .from(emails)
        .where(and(eq(emails.id, emailId), eq(emails.userId, user.id)))
        .limit(1);

      if (!emailRow[0]) return c.json({ error: "Email not found" }, 404);

      const cached = await getEmailDetailCached(db, emailId);

      return c.json({
        data: cached ?? {
          summary: null,
          suspicious: {
            isSuspicious: false,
            kind: null,
            reason: null,
            confidence: null,
          },
          actions: [],
          calendarEvents: [],
          autoExecute: [],
          requiresApproval: [],
        },
      }, 200);
    },
  );

  api.get(
    "/:emailId/ai/summary",
    zValidator("param", emailDetailParamsSchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const env = c.env;
      const { emailId } = c.req.valid("param");

      const emailRow = await db
        .select({ id: emails.id })
        .from(emails)
        .where(and(eq(emails.id, emailId), eq(emails.userId, user.id)))
        .limit(1);

      if (!emailRow[0]) return c.json({ error: "Email not found" }, 404);

      const { summary, prompt } = await getOrGenerateSummary(db, emailId);

      if (summary) {
        return c.json({ data: { summary } }, 200);
      }

      if (!prompt) {
        return c.json({ data: { summary: null } }, 200);
      }

      const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
      const result = await generateText({
        model: openai(EMAIL_INTELLIGENCE_MODEL),
        system: SUMMARY_SYSTEM,
        prompt,
        maxOutputTokens: 200,
      });

      const text = result.text.trim();
      if (text) {
        await saveSummary(db, emailId, text);
      }

      return c.json({ data: { summary: text || null } }, 200);
    },
  );
}
