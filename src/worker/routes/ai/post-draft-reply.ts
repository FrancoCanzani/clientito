import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { generateText } from "ai";
import { and, asc, eq } from "drizzle-orm";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import { emails } from "../../db/schema";
import type { AppRouteEnv } from "../types";

const PRIMARY_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const FALLBACK_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_RETRIES = 2;

const draftReplyBodySchema = z.object({
  emailId: z.coerce.number().int().positive(),
  instructions: z.string().trim().optional(),
});

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

type DraftReplyDb = {
  select: AppRouteEnv["Variables"]["db"]["select"];
  update: AppRouteEnv["Variables"]["db"]["update"];
};

export async function generateDraftForEmail(input: {
  db: DraftReplyDb;
  ai: Ai;
  userId: string;
  emailId: number;
  instructions?: string;
}): Promise<string | null> {
  const { db, ai, userId, emailId, instructions } = input;

  const emailRow = await db
    .select({
      id: emails.id,
      threadId: emails.threadId,
      fromAddr: emails.fromAddr,
      fromName: emails.fromName,
      subject: emails.subject,
      bodyText: emails.bodyText,
    })
    .from(emails)
    .where(and(eq(emails.id, emailId), eq(emails.userId, userId)))
    .limit(1);

  const email = emailRow[0];
  if (!email) return null;

  let threadContext = "";
  if (email.threadId) {
    const threadMessages = await db
      .select({
        fromAddr: emails.fromAddr,
        fromName: emails.fromName,
        bodyText: emails.bodyText,
        date: emails.date,
      })
      .from(emails)
      .where(
        and(eq(emails.threadId, email.threadId), eq(emails.userId, userId)),
      )
      .orderBy(asc(emails.date))
      .limit(5);

    threadContext = threadMessages
      .map((msg, i) => {
        const from = msg.fromName || msg.fromAddr;
        const body = truncate(
          (msg.bodyText ?? "").replace(/\s+/g, " ").trim(),
          500,
        );
        return `--- Message ${i + 1} from ${from} ---\n${body}`;
      })
      .join("\n\n");
  } else {
    const body = truncate(
      (email.bodyText ?? "").replace(/\s+/g, " ").trim(),
      1000,
    );
    threadContext = `--- Original email from ${email.fromName || email.fromAddr} ---\n${body}`;
  }

  const systemPrompt = [
    "You are a helpful email assistant. Draft a concise, professional reply.",
    "Match the conversation tone. Do not include subject line or greeting unless natural.",
    "Return only the reply body text, no metadata.",
  ].join(" ");

  const userPrompt = [
    `Subject: ${email.subject ?? "(no subject)"}`,
    "",
    "Thread context:",
    threadContext,
    "",
    instructions
      ? `Additional instructions: ${instructions}`
      : "Write a natural, concise reply.",
  ].join("\n");

  const workersAI = createWorkersAI({ binding: ai });
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];

  for (const model of models) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await generateText({
          model: workersAI(model),
          system: systemPrompt,
          prompt: userPrompt,
          maxOutputTokens: 300,
        });

        const draft = (result.text ?? "").trim();
        if (draft.length > 0) {
          await db
            .update(emails)
            .set({ draftReply: draft })
            .where(eq(emails.id, emailId));
          return draft;
        }
      } catch (error) {
        console.error(`Draft generation attempt ${attempt + 1} failed (model: ${model})`, {
          emailId,
          error,
        });
      }
    }
  }

  return null;
}

export function registerPostDraftReply(app: Hono<AppRouteEnv>) {
  app.post("/draft-reply", zValidator("json", draftReplyBodySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const { emailId, instructions } = c.req.valid("json");

    const draft = await generateDraftForEmail({
      db,
      ai: c.env.AI,
      userId: user.id,
      emailId,
      instructions,
    });

    if (draft === null) {
      return c.json({ error: "Failed to generate draft reply" }, 500 as never);
    }

    return c.json({ data: { draft } }, 200);
  });
}
