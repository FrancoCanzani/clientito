import { zValidator } from "@hono/zod-validator";
import { createOpenAI } from "@ai-sdk/openai";
import {
  generateText,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
} from "ai";
import type { Hono } from "hono";
import { z } from "zod";
import type { AppRouteEnv } from "../types";

const CATEGORY_VALUES = [
  "action_required",
  "invoice",
  "notification",
  "newsletter",
  "fyi",
  "unknown",
];
const CLASSIFY_MODEL = "gpt-5.4-mini";
const CLASSIFY_MAX_OUTPUT_TOKENS = 900;

const classifyThreadBodySchema = z.object({
  thread: z.object({
    subject: z.string().max(998).nullable().optional(),
    fromAddr: z.string().trim().min(1).max(320),
    fromName: z.string().max(240).nullable().optional(),
    toAddr: z.string().max(2000).nullable().optional(),
    snippet: z.string().max(5000).nullable().optional(),
    bodyText: z.string().max(30000).nullable().optional(),
    messages: z
      .array(
        z.object({
          fromAddr: z.string().trim().min(1).max(320),
          fromName: z.string().max(240).nullable().optional(),
          snippet: z.string().max(5000).nullable().optional(),
          bodyText: z.string().max(12000).nullable().optional(),
          date: z.number().int().nullable().optional(),
        }),
      )
      .max(12)
      .optional(),
  }),
});

const classifyThreadOutputSchema = z.object({
  category: z.enum(CATEGORY_VALUES),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(240),
  summary: z.string().min(1).max(500),
  draftReply: z.string().max(4000).optional().default(""),
});

const CLASSIFY_SYSTEM = [
  "You classify incoming email threads for a minimalist focus inbox.",
  "Return only the structured object requested by the output schema.",
  "Category definitions:",
  "- action_required: user should reply, approve, decide, or execute a concrete next step soon.",
  "- invoice: bills, receipts, payments, subscriptions, finance/compliance operations.",
  "- notification: automated alerts and status updates, including account/security/login notices.",
  "- newsletter: mailing list, digest, marketing campaign, promotional blast.",
  "- fyi: informational update with low urgency and no immediate action required.",
  "- unknown: unclear or mixed signal.",
  "Priority guidance when multiple categories match:",
  "invoice > action_required > notification > newsletter > fyi > unknown",
  "Set confidence to a number between 0 and 1.",
  "Reason must be concise and specific, no more than 1 sentence.",
  "Summary must be concise (1-2 sentences) and action-oriented.",
  "Draft reply requirements:",
  "- Only generate a draft when category is action_required AND a human reply is clearly expected (direct question, approval, decision, scheduling).",
  "- For invoice, notification, newsletter, fyi, unknown: always return an empty string. Do not draft acknowledgements or thank-yous.",
  "- For action_required threads where no reply is needed (e.g. automated request that just needs a click), also return an empty string.",
  "- Draft must be plain text, under 80 words, ready to send, no placeholders like [Name] or [Date].",
].join("\n");

type ThreadInput = z.infer<typeof classifyThreadBodySchema>["thread"];
type ClassificationOutput = z.infer<typeof classifyThreadOutputSchema>;
type ClassificationAttemptDebug = {
  finishReason: unknown;
  usage: unknown;
  warnings: unknown;
  responseId: unknown;
  textLength: number;
  textPreview: string;
  outputError: unknown;
  parsedFromText: boolean;
};

function buildClassificationPrompt(thread: ThreadInput): string {
  const messages =
    thread.messages?.map((message, index) => {
      const parts: string[] = [
        `Message ${index + 1}`,
        `From: ${message.fromName ? `${message.fromName} <${message.fromAddr}>` : message.fromAddr}`,
      ];
      if (message.date) {
        parts.push(`DateMs: ${message.date}`);
      }
      if (message.snippet) {
        parts.push(`Snippet: ${message.snippet}`);
      }
      if (message.bodyText) {
        parts.push(`Body: ${message.bodyText}`);
      }
      return parts.join("\n");
    }) ?? [];

  return [
    "Classify and summarize this email thread.",
    `Subject: ${thread.subject ?? ""}`,
    `From: ${thread.fromName ? `${thread.fromName} <${thread.fromAddr}>` : thread.fromAddr}`,
    `To: ${thread.toAddr ?? ""}`,
    `Snippet: ${thread.snippet ?? ""}`,
    `Body: ${thread.bodyText ?? ""}`,
    messages.length > 0
      ? `ThreadMessages:\n${messages.join("\n\n")}`
      : "ThreadMessages: none",
  ].join("\n\n");
}

function getErrorStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const statusCode = Reflect.get(error, "statusCode");
  if (typeof statusCode === "number" && Number.isFinite(statusCode)) {
    return statusCode;
  }
  const status = Reflect.get(error, "status");
  if (typeof status === "number" && Number.isFinite(status)) {
    return status;
  }
  return null;
}

function formatNoOutputCause(cause: unknown): unknown {
  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message,
      status: getErrorStatusCode(cause),
      code: Reflect.get(cause, "code"),
      cause: formatNoOutputCause(cause.cause),
    };
  }
  if (typeof cause === "object" && cause !== null) {
    return {
      name: Reflect.get(cause, "name"),
      message: Reflect.get(cause, "message"),
      status: getErrorStatusCode(cause),
      code: Reflect.get(cause, "code"),
    };
  }
  return cause;
}

function createEmptyOutputError(debug?: ClassificationAttemptDebug): Error {
  const error = new Error("No structured classification output generated.");
  error.name = "ClassificationEmptyOutputError";
  if (debug) {
    Reflect.set(error, "classificationDebug", debug);
  }
  return error;
}

function normalizeCategory(value: unknown): ClassificationOutput["category"] {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "unknown";
  if (CATEGORY_VALUES.includes(normalized)) {
    return normalized as ClassificationOutput["category"];
  }
  if (normalized === "actionrequired" || normalized === "action-required") {
    return "action_required";
  }
  return "unknown";
}

function normalizeConfidence(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(1, parsed));
    }
  }
  return 0.5;
}

function normalizeClassificationCandidate(
  candidate: unknown,
): ClassificationOutput | null {
  if (typeof candidate !== "object" || candidate === null) return null;
  const category = normalizeCategory(Reflect.get(candidate, "category"));
  const confidence = normalizeConfidence(Reflect.get(candidate, "confidence"));
  const reason =
    compactText(
      typeof Reflect.get(candidate, "reason") === "string"
        ? (Reflect.get(candidate, "reason") as string)
        : "",
      240,
    ) || "Model classified thread using partial signal.";
  const summary =
    compactText(
      typeof Reflect.get(candidate, "summary") === "string"
        ? (Reflect.get(candidate, "summary") as string)
        : "",
      500,
    ) || reason;
  const draftReply =
    compactText(
      typeof Reflect.get(candidate, "draftReply") === "string"
        ? (Reflect.get(candidate, "draftReply") as string)
        : "",
      4000,
    ) || "";

  return {
    category,
    confidence,
    reason,
    summary,
    draftReply,
  };
}

function parseClassificationFromText(text: string): ClassificationOutput | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const candidates: string[] = [trimmed];
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) candidates.unshift(fencedMatch[1].trim());
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1).trim());
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const validated = classifyThreadOutputSchema.safeParse(parsed);
      if (validated.success) return validated.data;
      const normalized = normalizeClassificationCandidate(parsed);
      if (normalized) return normalized;
    } catch {
      // keep trying
    }
  }
  return null;
}

function compactText(value: string | null | undefined, maxLength: number): string {
  if (!value) return "";
  const compacted = value.replace(/\s+/g, " ").trim();
  if (!compacted) return "";
  return compacted.length <= maxLength
    ? compacted
    : `${compacted.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function sanitizeLogPreview(value: string, maxLength = 280): string {
  const compacted = value.replace(/\s+/g, " ").trim();
  if (!compacted) return "";
  return compacted.length <= maxLength
    ? compacted
    : `${compacted.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function buildNoObjectGeneratedDebug(
  error: NoObjectGeneratedError,
): ClassificationAttemptDebug {
  const text = error.text ?? "";
  return {
    finishReason: error.finishReason,
    usage: error.usage,
    warnings: [],
    responseId: error.response?.id,
    textLength: text.length,
    textPreview: sanitizeLogPreview(text),
    outputError: {
      source: "no_object_generated",
      cause: formatNoOutputCause(error.cause),
      message: error.message,
    },
    parsedFromText: false,
  };
}

function readClassificationDebug(error: unknown): unknown {
  if (typeof error !== "object" || error === null) return undefined;
  return Reflect.get(error, "classificationDebug");
}

function inferDeterministicCategory(content: string): {
  category: ClassificationOutput["category"];
  confidence: number;
  reason: string;
} {
  const invoiceMatch =
    /\b(invoice|receipt|billing|payment|charged|charge|subscription|renewal|statement|tax|past due)\b/i;
  const actionRequiredMatch =
    /\b(action required|please reply|please review|approve|approval|confirm|decision|deadline|request|can you|could you)\b/i;
  const notificationMatch =
    /\b(notification|alert|security|signin|sign-in|login|verification|2fa|code|status update|reminder)\b/i;
  const newsletterMatch =
    /\b(newsletter|digest|unsubscribe|view in browser|promotion|promotional|deal|sale|offer)\b/i;
  const fyiMatch = /\b(fyi|for your information|heads up|just sharing|update)\b/i;

  if (invoiceMatch.test(content)) {
    return {
      category: "invoice",
      confidence: 0.86,
      reason: "Billing keywords detected in the thread content.",
    };
  }
  if (actionRequiredMatch.test(content)) {
    return {
      category: "action_required",
      confidence: 0.8,
      reason: "Explicit request or approval/reply language detected.",
    };
  }
  if (notificationMatch.test(content)) {
    return {
      category: "notification",
      confidence: 0.75,
      reason: "Automated alert/status language detected.",
    };
  }
  if (newsletterMatch.test(content)) {
    return {
      category: "newsletter",
      confidence: 0.78,
      reason: "Bulk-email markers like digest/unsubscribe were detected.",
    };
  }
  if (fyiMatch.test(content)) {
    return {
      category: "fyi",
      confidence: 0.68,
      reason: "Informational wording detected without a clear request.",
    };
  }
  return {
    category: "unknown",
    confidence: 0.45,
    reason: "No strong category signal found.",
  };
}

function buildDeterministicFallback(thread: ThreadInput): ClassificationOutput {
  const messageText = (thread.messages ?? [])
    .map((message) => `${message.snippet ?? ""}\n${message.bodyText ?? ""}`)
    .join("\n");
  const combined = [
    thread.subject ?? "",
    thread.snippet ?? "",
    thread.bodyText ?? "",
    messageText,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  const inferred = inferDeterministicCategory(combined);
  const summarySource =
    compactText(thread.snippet, 220) ||
    compactText(thread.bodyText, 220) ||
    compactText((thread.messages ?? []).map((message) => message.snippet ?? "").join(" "), 220);
  const summary =
    summarySource ||
    "New email received. Open thread to review details and decide the next step.";

  const sender = thread.fromName?.trim() || thread.fromAddr;
  const draftReply =
    inferred.category === "action_required"
      ? `Hi ${sender},\n\nThanks for the message. I will review this and get back to you shortly.\n\nBest,`
      : "";

  return {
    category: inferred.category,
    confidence: inferred.confidence,
    reason: inferred.reason,
    summary: compactText(summary, 500) || "Email received.",
    draftReply: compactText(draftReply, 4000),
  };
}

function resolveClassificationOutput(
  result: Awaited<ReturnType<typeof generateText>>,
): { output: ClassificationOutput | null; debug: ClassificationAttemptDebug } {
  let outputError: unknown = null;
  let resolvedFromOutput: ClassificationOutput | null = null;
  try {
    const validated = classifyThreadOutputSchema.safeParse(result.output);
    if (validated.success) {
      resolvedFromOutput = validated.data;
    } else {
      const normalized = normalizeClassificationCandidate(result.output);
      if (normalized) {
        resolvedFromOutput = normalized;
      }
      outputError = {
        source: "result.output.validation",
        issues: validated.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        })),
      };
    }
  } catch (error) {
    if (!NoOutputGeneratedError.isInstance(error)) {
      throw error;
    }
    outputError = {
      source: "result.output.no_output",
      cause: formatNoOutputCause(error.cause),
      message: error.message,
    };
  }
  const parsedFromText = parseClassificationFromText(result.text);
  return {
    output: resolvedFromOutput ?? parsedFromText,
    debug: {
      finishReason: Reflect.get(result, "finishReason"),
      usage: Reflect.get(result, "usage"),
      warnings: Reflect.get(result, "warnings"),
      responseId: Reflect.get(Reflect.get(result, "response"), "id"),
      textLength: result.text.length,
      textPreview: sanitizeLogPreview(result.text),
      outputError,
      parsedFromText: parsedFromText !== null,
    },
  };
}

export function registerPostClassifyThread(app: Hono<AppRouteEnv>) {
  app.post(
    "/classify",
    zValidator("json", classifyThreadBodySchema),
    async (c) => {
      const { thread } = c.req.valid("json");
      const openai = createOpenAI({ apiKey: c.env.OPENAI_API_KEY });

      try {
        const prompt = buildClassificationPrompt(thread);
        const result = await generateText({
          model: openai.responses(CLASSIFY_MODEL),
          system: CLASSIFY_SYSTEM,
          prompt,
          providerOptions: {
            openai: {
              strictJsonSchema: false,
            },
          },
          output: Output.object({
            name: "inbox_thread_classification",
            description:
              "Focused inbox triage result with category, confidence, reason, summary, and optional draft reply.",
            schema: classifyThreadOutputSchema,
          }),
          maxOutputTokens: CLASSIFY_MAX_OUTPUT_TOKENS,
        });
        const resolved = resolveClassificationOutput(result);
        if (resolved.output) {
          return c.json(
            {
              data: resolved.output,
            },
            200,
          );
        }
        console.warn("Thread classification unparseable output", {
          model: CLASSIFY_MODEL,
          debug: resolved.debug,
        });
        throw createEmptyOutputError(resolved.debug);
      } catch (error) {
        if (NoObjectGeneratedError.isInstance(error)) {
          const recovered = parseClassificationFromText(error.text ?? "");
          if (recovered) {
            return c.json(
              {
                data: recovered,
              },
              200,
            );
          }
          const debug = buildNoObjectGeneratedDebug(error);
          Reflect.set(error, "classificationDebug", debug);
        }

        const noOutputCause = NoOutputGeneratedError.isInstance(error)
          ? formatNoOutputCause(error.cause)
          : undefined;
        const classificationDebug = readClassificationDebug(error);
        const fallback = buildDeterministicFallback(thread);
        console.error("Thread classification failed", {
          model: CLASSIFY_MODEL,
          error,
          noOutputCause,
          classificationDebug,
          fallbackCategory: fallback.category,
        });
        return c.json(
          {
            data: fallback,
            degraded: true,
          },
          200,
        );
      }
    },
  );
}
