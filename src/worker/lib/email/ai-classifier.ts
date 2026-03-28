import { Output, generateText } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import { chunkArray, withRetry } from "../utils";
import { AI_MODELS } from "../constants";

const BATCH_SIZE = 10;

const AI_LABELS = [
  "action_needed",
  "important",
  "newsletter",
  "marketing",
  "transactional",
  "notification",
] as const;

type AiLabel = (typeof AI_LABELS)[number];
const aiLabelSchema = z.enum(AI_LABELS);

type EmailForClassification = {
  index: number;
  from: string;
  fromName?: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText?: string | null;
  hasUnsubscribe?: boolean;
};

type UserFilterRule = {
  id: number;
  description: string;
};

type ClassificationResult = {
  labels: Map<number, AiLabel>;
  filterMatches: Map<number, number[]>;
};

const TRANSACTIONAL_HINTS = [
  "receipt",
  "invoice",
  "order confirmed",
  "order confirmation",
  "payment received",
  "shipping",
  "shipped",
  "delivery",
  "password reset",
  "verification code",
  "security code",
  "one-time passcode",
  "otp",
];

const MARKETING_HINTS = [
  "discount",
  "deal",
  "offer",
  "promo",
  "promotion",
  "upgrade",
  "trial",
  "save ",
  "limited time",
  "flash sale",
  "pricing",
];

const NEWSLETTER_HINTS = [
  "newsletter",
  "weekly roundup",
  "daily roundup",
  "digest",
  "edition",
  "top stories",
];

const IMPORTANT_HINTS = [
  "invoice available",
  "bill available",
  "billing alert",
  "payment due",
  "past due",
  "service interruption",
  "service suspension",
  "credit history",
  "credit score",
  "credit report",
  "factura disponible",
  "tu factura",
  "factura de electricidad",
  "historial crediticio",
  "pago pendiente",
  "vencimiento",
];

const NOTIFICATION_HINTS = [
  "terms and conditions",
  "terms & conditions",
  "privacy policy",
  "policy update",
  "product update",
  "new features",
  "profile views",
  "visualizaciones del perfil",
  "notifications",
  "notification",
  "do not reply",
  "do not respond",
  "automatically sent",
  "automated message",
  "this email is intended to",
];

function compactText(value: string | null | undefined, maxLength: number): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function includesAny(content: string, hints: string[]): boolean {
  return hints.some((hint) => content.includes(hint));
}

function classifyActionNeededOverride(
  email: EmailForClassification,
): Exclude<AiLabel, "action_needed" | "later"> | null {
  const content = [
    email.from,
    email.fromName,
    email.subject,
    email.snippet,
    email.bodyText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (includesAny(content, MARKETING_HINTS)) {
    return "marketing";
  }

  if (includesAny(content, NEWSLETTER_HINTS)) {
    return "newsletter";
  }

  if (includesAny(content, IMPORTANT_HINTS)) {
    return "important";
  }

  if (email.hasUnsubscribe || includesAny(content, NOTIFICATION_HINTS)) {
    return "notification";
  }

  if (includesAny(content, TRANSACTIONAL_HINTS)) {
    return "transactional";
  }

  return null;
}

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
        label: aiLabelSchema,
        ...(hasFilters
          ? { matchedFilters: z.array(z.number()).optional() }
          : {}),
      }),
    ),
  });

  const models = AI_MODELS;

  for (const chunk of chunkArray(emailBatch, BATCH_SIZE)) {
    const emailList = chunk
      .map(
        (email) =>
          [
            `[${email.index}]`,
            `From: ${email.fromName ? `${email.fromName} <${email.from}>` : email.from}`,
            `Subject: ${email.subject ?? "(no subject)"}`,
            `Preview: ${compactText(email.snippet, 180) || "(empty)"}`,
            `Body excerpt: ${compactText(email.bodyText, 260) || "(empty)"}`,
            `Has unsubscribe signals: ${email.hasUnsubscribe ? "yes" : "no"}`,
          ].join(" | "),
      )
      .join("\n");

    let filterSection = "";
    if (hasFilters) {
      const filterList = userFilters
        .map((filter) => `  Filter #${filter.id}: ${filter.description}`)
        .join("\n");
      filterSection = `\n\nUser filter rules (return matching filter IDs in "matchedFilters" for each email):\n${filterList}`;
    }

    const prompt = `Classify each email into exactly one category.

Use a conservative standard for "action_needed". Action-needed emails should be rare.

Decision rules:
1. First decide whether the email is bulk, automated, or system-generated.
2. If it is bulk, automated, digest-style, legal/policy-related, product-update mail, social-summary mail, or includes unsubscribe/system disclaimer signals, it must NOT be labeled "action_needed".
3. Use "action_needed" only when a human likely expects the user to reply or take a concrete next step.
4. Use "important" for relevant mail worth reviewing soon even if no reply is expected.
5. Classify by intent, not keywords, and do this correctly regardless of language.

Categories:
- action_needed: A human likely expects the user to reply or take a concrete next step
- important: Relevant and worth reviewing soon, but no clear reply or action is expected
- newsletter: Curated content the user subscribed to - blog digests, weekly roundups, industry reports, editorial newsletters (e.g. Stratechery, Morning Brew, Substack authors)
- marketing: Promotional emails, ads, sales, discounts, flash deals, company announcements pushing a product or offer (e.g. Ryanair deals, Amazon promos, SaaS upgrade nudges)
- transactional: Receipts, order confirmations, shipping notifications, password resets, verification codes
- notification: Automated alerts from apps/services, product updates, legal/policy notices, account summaries, social media notifications, and system-generated informational mail

Never label these as action_needed:
- Terms or privacy updates
- Product or feature announcements
- LinkedIn/profile view summaries
- Bulk notifications from companies or platforms
- Emails that say they were sent automatically or should not be replied to

Examples:
- "We updated our Terms and Conditions" -> notification
- "Your LinkedIn profile got 34 views" -> notification
- "Ya tienes disponible tu factura de electricidad" -> important
- "Evitá que tu historial crediticio empeore" -> important
- "Can you review this contract and send edits today?" -> action_needed
- "Your receipt / verification code" -> transactional
- "20% off / upgrade now / limited offer" -> marketing
${filterSection}

Emails:
${emailList}

Return a JSON object with a "results" array. Each item must have "index" (the number in brackets) and "label" (one of: action_needed, important, newsletter, marketing, transactional, notification).${hasFilters ? ' Each item should also have "matchedFilters" - an array of filter IDs that apply to that email (empty array if none match).' : ""}`;

    let classified = false;

    for (const model of models) {
      try {
        const { output } = await withRetry(
          () => generateText({
            model: workersAI(model),
            output: Output.object({ schema }),
            prompt,
          }),
          { maxRetries: 1, baseDelayMs: 2000, label: "email-classification" },
        );

        for (const row of output.results) {
          const email = chunk.find((candidate) => candidate.index === row.index);
          const label =
            row.label === "action_needed" && email
              ? classifyActionNeededOverride(email) ?? row.label
              : row.label;
          result.labels.set(row.index, label);
          const matched = (row as { matchedFilters?: number[] }).matchedFilters;
          if (matched && matched.length > 0) {
            result.filterMatches.set(row.index, matched);
          }
        }

        classified = true;
        break;
      } catch (error) {
        console.error(`Email classification failed (model: ${model})`, error);
      }
    }

    if (!classified) {
      console.error("Email classification failed for batch after all models");
    }
  }

  return result;
}
