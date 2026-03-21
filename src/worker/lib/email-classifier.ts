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
  "marketing",
  "transactional",
  "notification",
] as const;

export type AiLabel = (typeof AI_LABELS)[number];

type EmailForClassification = {
  index: number;
  from: string;
  subject: string | null;
  snippet: string | null;
};

type UserFilterRule = {
  id: number;
  description: string;
};

type ClassificationResult = {
  labels: Map<number, AiLabel>;
  filterMatches: Map<number, number[]>;
};

export async function classifyEmails(
  ai: Ai,
  emailBatch: EmailForClassification[],
  userFilters: UserFilterRule[] = [],
): Promise<ClassificationResult> {
  const result: ClassificationResult = {
    labels: new Map(),
    filterMatches: new Map(),
  };

  if (emailBatch.length === 0) return result;

  const hasFilters = userFilters.length > 0;
  const workersAI = createWorkersAI({ binding: ai });

  const schema = z.object({
    results: z.array(
      z.object({
        index: z.number(),
        label: z.enum(AI_LABELS),
        ...(hasFilters
          ? { matchedFilters: z.array(z.number()).optional() }
          : {}),
      }),
    ),
  });

  for (const chunk of chunkArray(emailBatch, BATCH_SIZE)) {
    try {
      const emailList = chunk
        .map(
          (e) =>
            `[${e.index}] From: ${e.from} | Subject: ${e.subject ?? "(no subject)"} | Preview: ${(e.snippet ?? "").slice(0, 120)}`,
        )
        .join("\n");

      let filterSection = "";
      if (hasFilters) {
        const filterList = userFilters
          .map((f) => `  Filter #${f.id}: ${f.description}`)
          .join("\n");
        filterSection = `\n\nUser filter rules (return matching filter IDs in "matchedFilters" for each email):\n${filterList}`;
      }

      const { object } = await generateObject({
        model: workersAI(MODEL),
        schema,
        prompt: `Classify each email into exactly one category.

Categories:
- important: Personal emails, direct messages from real people, time-sensitive requests, emails requiring action
- later: Non-urgent but relevant — FYI updates, discussions you're CC'd on, low-priority requests
- newsletter: Curated content the user subscribed to — blog digests, weekly roundups, industry reports, editorial newsletters (e.g. Stratechery, Morning Brew, Substack authors)
- marketing: Promotional emails, ads, sales, discounts, flash deals, company announcements pushing a product or offer (e.g. Ryanair deals, Amazon promos, SaaS upgrade nudges)
- transactional: Receipts, order confirmations, shipping notifications, password resets, verification codes
- notification: Automated alerts from apps/services — GitHub, Slack, calendar, social media notifications
${filterSection}

Emails:
${emailList}

Return a JSON object with a "results" array. Each item must have "index" (the number in brackets) and "label" (one of: important, later, newsletter, marketing, transactional, notification).${hasFilters ? ' Each item should also have "matchedFilters" — an array of filter IDs that apply to that email (empty array if none match).' : ""}`,
      });

      for (const r of object.results) {
        if (AI_LABELS.includes(r.label)) {
          result.labels.set(r.index, r.label);
        }
        const matched = (r as { matchedFilters?: number[] }).matchedFilters;
        if (matched && matched.length > 0) {
          result.filterMatches.set(r.index, matched);
        }
      }
    } catch (error) {
      console.error("Email classification failed for batch", error);
    }
  }

  return result;
}
