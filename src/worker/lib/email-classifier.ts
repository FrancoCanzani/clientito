import { generateObject } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import { chunkArray } from "./utils";

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const BATCH_SIZE = 10;

const AI_LABELS = [
  "important",
  "later",
  "newsletter",
  "transactional",
  "notification",
] as const;

export type AiLabel = (typeof AI_LABELS)[number];

const classificationSchema = z.object({
  results: z.array(
    z.object({
      index: z.number(),
      label: z.enum(AI_LABELS),
    }),
  ),
});

type EmailForClassification = {
  index: number;
  from: string;
  subject: string | null;
  snippet: string | null;
};

export async function classifyEmails(
  ai: Ai,
  emailBatch: EmailForClassification[],
): Promise<Map<number, AiLabel>> {
  if (emailBatch.length === 0) return new Map();

  const workersAI = createWorkersAI({ binding: ai });
  const labels = new Map<number, AiLabel>();

  for (const chunk of chunkArray(emailBatch, BATCH_SIZE)) {
    try {
      const emailList = chunk
        .map(
          (e) =>
            `[${e.index}] From: ${e.from} | Subject: ${e.subject ?? "(no subject)"} | Preview: ${(e.snippet ?? "").slice(0, 120)}`,
        )
        .join("\n");

      const { object } = await generateObject({
        model: workersAI(MODEL),
        schema: classificationSchema,
        prompt: `Classify each email into exactly one category.

Categories:
- important: Personal emails, direct messages from real people, time-sensitive requests, emails requiring action
- later: Non-urgent but relevant — FYI updates, discussions you're CC'd on, low-priority requests
- newsletter: Newsletters, digests, blog updates, marketing content from companies
- transactional: Receipts, order confirmations, shipping notifications, password resets, verification codes
- notification: Automated alerts from apps/services — GitHub, Slack, calendar, social media notifications

Emails:
${emailList}

Return a JSON object with a "results" array. Each item must have "index" (the number in brackets) and "label" (one of: important, later, newsletter, transactional, notification).`,
      });

      for (const r of object.results) {
        if (AI_LABELS.includes(r.label)) {
          labels.set(r.index, r.label);
        }
      }
    } catch (error) {
      console.error("Email classification failed for batch", error);
    }
  }

  return labels;
}
