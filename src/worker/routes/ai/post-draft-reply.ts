import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { emails } from "../../db/schema";
import { generateEmailOnDemand } from "../../lib/email/intelligence/detail";
import type { AppRouteEnv } from "../types";

const draftReplyBodySchema = z.object({
  emailId: z.coerce.number().int().positive(),
  instructions: z.string().trim().max(1000).optional(),
});

export async function generateDraftForEmail(input: {
  db: AppRouteEnv["Variables"]["db"];
  env: Env;
  userId: string;
  emailId: number;
}) {
  const { db, userId, emailId } = input;

  const emailRow = await db
    .select({ id: emails.id })
    .from(emails)
    .where(and(eq(emails.id, emailId), eq(emails.userId, userId)))
    .limit(1);

  if (!emailRow[0]) return null;

  const intelligence = await generateEmailOnDemand(
    db,
    input.env,
    emailId,
  );

  return intelligence?.replyDraft ?? null;
}

export function registerPostDraftReply(app: Hono<AppRouteEnv>) {
  app.post("/draft-reply", zValidator("json", draftReplyBodySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const { emailId } = c.req.valid("json");

    const draft = await generateDraftForEmail({
      db,
      env: c.env,
      userId: user.id,
      emailId,
    });

    if (draft === null) {
      return c.json({ error: "Failed to load draft reply" }, 404 as never);
    }

    return c.json({ data: { draft } }, 200);
  });
}
