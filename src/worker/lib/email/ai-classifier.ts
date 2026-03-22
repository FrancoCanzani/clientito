import { Output, generateText } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import { chunkArray } from "../utils";

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const BATCH_SIZE = 10;

type AiLabel =
  | "important"
  | "later"
  | "newsletter"
  | "marketing"
  | "transactional"
  | "notification";

const AI_LABELS: AiLabel[] = [
  "important",
  "later",
  "newsletter",
  "marketing",
  "transactional",
  "notification",
];

const aiLabelSchema = z.union([
  z.literal("important"),
  z.literal("later"),
  z.literal("newsletter"),
  z.literal("marketing"),
  z.literal("transactional"),
  z.literal("notification"),
]);

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

function classifyImportantOverride(
  email: EmailForClassification,
): Exclude<AiLabel, "important"> | null {
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

  if (includesAny(content, TRANSACTIONAL_HINTS)) {
    return "transactional";
  }

  if (includesAny(content, MARKETING_HINTS)) {
    return "marketing";
  }

  if (includesAny(content, NEWSLETTER_HINTS)) {
    return "newsletter";
  }

  if (email.hasUnsubscribe || includesAny(content, NOTIFICATION_HINTS)) {
    return "notification";
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

  for (const chunk of chunkArray(emailBatch, BATCH_SIZE)) {
    try {
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

      const { output } = await generateText({
        model: workersAI(MODEL),
        output: Output.object({ schema }),
        prompt: `Classify each email into exactly one category.

Use a conservative standard for "important". Important should be rare.

Decision rules:
1. First decide whether the email is bulk, automated, or system-generated.
2. If it is bulk, automated, digest-style, legal/policy-related, product-update mail, social-summary mail, or includes unsubscribe/system disclaimer signals, it must NOT be labeled "important".
3. Only use "important" for direct human-to-human communication or truly urgent, user-specific operational messages that likely need timely attention.

Categories:
- important: Direct human-to-human emails, personal outreach, explicit requests from a real person, or truly urgent user-specific operational issues that likely need timely attention
- later: Non-urgent but relevant - FYI updates, discussions you're CC'd on, low-priority requests
- newsletter: Curated content the user subscribed to - blog digests, weekly roundups, industry reports, editorial newsletters (e.g. Stratechery, Morning Brew, Substack authors)
- marketing: Promotional emails, ads, sales, discounts, flash deals, company announcements pushing a product or offer (e.g. Ryanair deals, Amazon promos, SaaS upgrade nudges)
- transactional: Receipts, order confirmations, shipping notifications, password resets, verification codes
- notification: Automated alerts from apps/services, product updates, legal/policy notices, account summaries, social media notifications, and system-generated informational mail

Never label these as important:
- Terms or privacy updates
- Product or feature announcements
- LinkedIn/profile view summaries
- Bulk notifications from companies or platforms
- Emails that say they were sent automatically or should not be replied to

Examples:
- "We updated our Terms and Conditions" -> notification
- "Your LinkedIn profile got 34 views" -> notification
- "Your receipt / verification code / invoice" -> transactional
- "20% off / upgrade now / limited offer" -> marketing
${filterSection}

Emails:
${emailList}

Return a JSON object with a "results" array. Each item must have "index" (the number in brackets) and "label" (one of: important, later, newsletter, marketing, transactional, notification).${hasFilters ? ' Each item should also have "matchedFilters" - an array of filter IDs that apply to that email (empty array if none match).' : ""}`,
      });

      for (const row of output.results) {
        if (AI_LABELS.includes(row.label)) {
          const email = chunk.find((candidate) => candidate.index === row.index);
          const label =
            row.label === "important" && email
              ? classifyImportantOverride(email) ?? row.label
              : row.label;
          result.labels.set(row.index, label);
        }
        const matched = (row as { matchedFilters?: number[] }).matchedFilters;
        if (matched && matched.length > 0) {
          result.filterMatches.set(row.index, matched);
        }
      }
    } catch (error) {
      console.error("Email classification failed for batch", error);
    }
  }

  return result;
}
