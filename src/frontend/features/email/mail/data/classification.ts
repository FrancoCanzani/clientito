import { localDb } from "@/db/client";
import type { EmailAICategory } from "@/db/schema";
import { accountsQueryOptions } from "@/hooks/use-mailboxes";
import { queryClient } from "@/lib/query-client";
import { asyncQueue } from "@tanstack/pacer/async-queuer";
import { invalidateInboxQueriesThrottled } from "./invalidation";
import type { PulledEmail } from "./types";

const CLASSIFICATION_MAX_CONCURRENCY = 2;
const CLASSIFICATION_MAX_MESSAGES = 6;
const CLASSIFICATION_MAX_SUMMARY_TEXT = 1400;
const CLASSIFICATION_MAX_BODY_TEXT = 2500;
const CLASSIFICATION_REQUEST_MAX_RETRIES = 2;
const CLASSIFICATION_RETRYABLE_STATUS_CODES = new Set([
  408, 409, 425, 429, 500, 502, 503, 504,
]);

const CLASSIFICATION_CATEGORIES = [
  "action_required",
  "invoice",
  "notification",
  "newsletter",
  "fyi",
  "unknown",
] as const;

type ClassificationCategory = EmailAICategory;
const CLASSIFICATION_CATEGORY_SET = new Set<string>(CLASSIFICATION_CATEGORIES);

const CLASSIFICATION_MIN_CONFIDENCE = 0.8;

type ClassifyThreadPayload = {
  mailboxId: number;
  thread: {
    subject: string | null;
    fromAddr: string;
    fromName: string | null;
    toAddr: string | null;
    snippet: string | null;
    bodyText: string | null;
    messages?: Array<{
      fromAddr: string;
      fromName: string | null;
      snippet: string | null;
      bodyText: string | null;
      date: number | null;
    }>;
  };
};

type ThreadClassificationResult = {
  category: ClassificationCategory;
  confidence: number;
  reason: string;
  summary: string;
  draftReply: string;
};

type ThreadClassificationTask = {
  userId: string;
  mailboxId: number;
  threadId: string | null;
  representativeProviderMessageId: string;
  classificationKey: string;
  payload: ClassifyThreadPayload;
};

const classificationQueuedKeys = new Set<string>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeClassificationRetryDelayMs(attempt: number): number {
  const baseDelayMs = 700;
  const jitterMs = Math.floor(Math.random() * 500);
  return baseDelayMs * 2 ** attempt + jitterMs;
}

function clampText(
  value: string | null | undefined,
  max: number,
): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.length <= max ? normalized : normalized.slice(0, max);
}

function buildClassificationTasks(
  pulled: PulledEmail[],
  userId: string,
  mailboxId: number,
): ThreadClassificationTask[] {
  const groups = new Map<string, PulledEmail[]>();
  for (const email of pulled) {
    const key = email.threadId ?? `pm:${email.providerMessageId}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(email);
    else groups.set(key, [email]);
  }

  const tasks: ThreadClassificationTask[] = [];
  for (const [groupKey, emails] of groups) {
    const sorted = [...emails].sort((left, right) => right.date - left.date);
    const representative = sorted[0];
    if (!representative) continue;
    if (representative.direction !== "received") continue;

    const messages = sorted
      .slice(0, CLASSIFICATION_MAX_MESSAGES)
      .map((email) => ({
        fromAddr: email.fromAddr,
        fromName: email.fromName ?? null,
        snippet: clampText(email.snippet, CLASSIFICATION_MAX_SUMMARY_TEXT),
        bodyText: clampText(email.bodyText, CLASSIFICATION_MAX_BODY_TEXT),
        date: Number.isFinite(email.date) ? email.date : null,
      }));

    tasks.push({
      userId,
      mailboxId,
      threadId: representative.threadId,
      representativeProviderMessageId: representative.providerMessageId,
      classificationKey: `${mailboxId}:${groupKey}:${representative.providerMessageId}`,
      payload: {
        mailboxId,
        thread: {
          subject: representative.subject ?? null,
          fromAddr: representative.fromAddr,
          fromName: representative.fromName ?? null,
          toAddr: representative.toAddr ?? null,
          snippet: clampText(
            representative.snippet,
            CLASSIFICATION_MAX_SUMMARY_TEXT,
          ),
          bodyText: clampText(
            representative.bodyText,
            CLASSIFICATION_MAX_BODY_TEXT,
          ),
          messages,
        },
      },
    });
  }

  return tasks;
}

function parseClassificationResponse(
  payload: unknown,
): ThreadClassificationResult | null {
  if (typeof payload !== "object" || payload === null) return null;
  const data = Reflect.get(payload, "data");
  if (typeof data !== "object" || data === null) return null;

  const categoryRaw = Reflect.get(data, "category");
  const confidenceRaw = Reflect.get(data, "confidence");
  const reasonRaw = Reflect.get(data, "reason");
  const summaryRaw = Reflect.get(data, "summary");
  const draftReplyRaw = Reflect.get(data, "draftReply");

  if (
    typeof categoryRaw !== "string" ||
    !CLASSIFICATION_CATEGORY_SET.has(categoryRaw)
  ) {
    return null;
  }
  if (typeof confidenceRaw !== "number" || !Number.isFinite(confidenceRaw)) {
    return null;
  }
  if (typeof reasonRaw !== "string" || typeof summaryRaw !== "string") {
    return null;
  }
  if (typeof draftReplyRaw !== "string") {
    return null;
  }

  const clampedConfidence = Math.max(0, Math.min(1, confidenceRaw));
  return {
    category: categoryRaw as ClassificationCategory,
    confidence: clampedConfidence,
    reason: reasonRaw,
    summary: summaryRaw,
    draftReply: draftReplyRaw,
  };
}

async function requestThreadClassification(
  payload: ClassifyThreadPayload,
): Promise<ThreadClassificationResult | null> {
  for (
    let attempt = 0;
    attempt <= CLASSIFICATION_REQUEST_MAX_RETRIES;
    attempt++
  ) {
    try {
      const response = await fetch("/api/ai/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const canRetry =
          attempt < CLASSIFICATION_REQUEST_MAX_RETRIES &&
          CLASSIFICATION_RETRYABLE_STATUS_CODES.has(response.status);
        if (canRetry) {
          await sleep(computeClassificationRetryDelayMs(attempt));
          continue;
        }
        return null;
      }

      const json = await response.json().catch(() => null);
      const parsed = parseClassificationResponse(json);
      if (parsed) return parsed;

      if (attempt < CLASSIFICATION_REQUEST_MAX_RETRIES) {
        await sleep(computeClassificationRetryDelayMs(attempt));
        continue;
      }
      return null;
    } catch {
      if (attempt < CLASSIFICATION_REQUEST_MAX_RETRIES) {
        await sleep(computeClassificationRetryDelayMs(attempt));
        continue;
      }
      return null;
    }
  }

  return null;
}

async function processThreadClassificationTask(
  task: ThreadClassificationTask,
): Promise<void> {
  try {
    const isFresh = await localDb.isThreadClassificationFresh({
      userId: task.userId,
      mailboxId: task.mailboxId,
      threadId: task.threadId,
      representativeProviderMessageId: task.representativeProviderMessageId,
      classificationKey: task.classificationKey,
    });
    if (isFresh) return;

    const classified = await requestThreadClassification(task.payload);
    if (!classified) return;

    const gatedCategory: EmailAICategory =
      classified.confidence >= CLASSIFICATION_MIN_CONFIDENCE
        ? classified.category
        : "unknown";
    const gatedDraftReply =
      gatedCategory === "action_required" ? classified.draftReply : "";

    await localDb.updateThreadClassification({
      userId: task.userId,
      mailboxId: task.mailboxId,
      threadId: task.threadId,
      representativeProviderMessageId: task.representativeProviderMessageId,
      classificationKey: task.classificationKey,
      category: gatedCategory,
      confidence: classified.confidence,
      reason: classified.reason,
      summary: classified.summary,
      draftReply: gatedDraftReply,
      classifiedAt: Date.now(),
    });

    invalidateInboxQueriesThrottled();
  } catch {
    /* classification is best-effort */
  }
}

const enqueueThreadClassification = asyncQueue<ThreadClassificationTask>(
  async (task) => {
    try {
      await processThreadClassificationTask(task);
    } finally {
      classificationQueuedKeys.delete(task.classificationKey);
    }
  },
  {
    concurrency: CLASSIFICATION_MAX_CONCURRENCY,
    throwOnError: false,
    onError: () => {},
  },
);

function isMailboxClassificationEnabled(mailboxId: number): boolean {
  const cached = queryClient.getQueryData(accountsQueryOptions.queryKey);
  const account = cached?.accounts.find((a) => a.mailboxId === mailboxId);
  return account?.aiClassificationEnabled ?? false;
}

export function enqueueClassificationTasks(
  pulled: PulledEmail[],
  userId: string,
  mailboxId: number,
): void {
  if (!isMailboxClassificationEnabled(mailboxId)) return;
  const tasks = buildClassificationTasks(pulled, userId, mailboxId);
  if (tasks.length === 0) return;

  for (const task of tasks) {
    if (classificationQueuedKeys.has(task.classificationKey)) continue;
    classificationQueuedKeys.add(task.classificationKey);
    enqueueThreadClassification(task);
  }
}
