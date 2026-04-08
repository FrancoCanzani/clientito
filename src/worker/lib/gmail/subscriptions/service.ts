import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../../db/client";
import {
  emailSubscriptions,
  type EmailSubscriptionMethod,
  type EmailSubscriptionStatus,
} from "../../../db/schema";

function buildSubscriptionSenderKey(fromAddr: string) {
  return fromAddr.trim().toLowerCase();
}

export function normalizeUnsubscribeUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

export function normalizeUnsubscribeEmail(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const candidate = trimmed.startsWith("mailto:")
    ? parseMailtoAddress(trimmed)
    : trimmed;
  if (!candidate) return null;

  const normalized = candidate
    .split("?")[0]
    .split(",")[0]
    .trim()
    .toLowerCase();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function parseMailtoAddress(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "mailto:") return null;
    return decodeURIComponent(parsed.pathname || "").trim() || null;
  } catch {
    return value.replace(/^mailto:/i, "").trim() || null;
  }
}

type SubscriptionEvent = {
  fromAddr: string;
  fromName: string | null;
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  receivedAt: number;
  emailCountDelta: number;
};

type MarkSubscriptionStatusInput = {
  fromAddr: string;
  unsubscribeUrl?: string | null;
  unsubscribeEmail?: string | null;
  status: EmailSubscriptionStatus;
  method?: EmailSubscriptionMethod | null;
};

export async function syncEmailSubscriptions(
  db: Database,
  userId: string,
  mailboxId: number | null,
  events: SubscriptionEvent[],
) {
  if (events.length === 0) return;

  const aggregated = new Map<
    string,
    SubscriptionEvent & { senderKey: string }
  >();

  for (const event of events) {
    const senderKey = buildSubscriptionSenderKey(event.fromAddr);
    const existing = aggregated.get(senderKey);

    if (!existing) {
      aggregated.set(senderKey, { ...event, senderKey });
      continue;
    }

    aggregated.set(senderKey, {
      senderKey,
      fromAddr: event.fromAddr || existing.fromAddr,
      fromName: event.fromName ?? existing.fromName,
      unsubscribeUrl: event.unsubscribeUrl ?? existing.unsubscribeUrl,
      unsubscribeEmail: event.unsubscribeEmail ?? existing.unsubscribeEmail,
      receivedAt: Math.max(existing.receivedAt, event.receivedAt),
      emailCountDelta: existing.emailCountDelta + event.emailCountDelta,
    });
  }

  const senderKeys = [...aggregated.keys()];
  const existingRows =
    senderKeys.length === 0
      ? []
      : await db
          .select({
            id: emailSubscriptions.id,
            senderKey: emailSubscriptions.senderKey,
            status: emailSubscriptions.status,
            emailCount: emailSubscriptions.emailCount,
            lastReceivedAt: emailSubscriptions.lastReceivedAt,
            unsubscribedAt: emailSubscriptions.unsubscribedAt,
          })
          .from(emailSubscriptions)
          .where(
            and(
              eq(emailSubscriptions.userId, userId),
              inArray(emailSubscriptions.senderKey, senderKeys),
            ),
          );

  const existingBySenderKey = new Map(
    existingRows.map((row) => [row.senderKey, row]),
  );
  const now = Date.now();

  for (const event of aggregated.values()) {
    const existing = existingBySenderKey.get(event.senderKey);

    if (!existing) {
      await db.insert(emailSubscriptions).values({
        userId,
        mailboxId,
        senderKey: event.senderKey,
        fromAddr: event.fromAddr,
        fromName: event.fromName,
        unsubscribeUrl: event.unsubscribeUrl,
        unsubscribeEmail: event.unsubscribeEmail,
        status: "active",
        emailCount: Math.max(1, event.emailCountDelta),
        lastReceivedAt: event.receivedAt,
        createdAt: now,
        updatedAt: now,
      });
      continue;
    }

    const shouldReactivate =
      existing.status !== "active" &&
      existing.unsubscribedAt !== null &&
      event.receivedAt > existing.unsubscribedAt;

    await db
      .update(emailSubscriptions)
      .set({
        fromAddr: event.fromAddr,
        fromName: event.fromName,
        unsubscribeUrl: event.unsubscribeUrl,
        unsubscribeEmail: event.unsubscribeEmail,
        emailCount: existing.emailCount + event.emailCountDelta,
        lastReceivedAt: Math.max(existing.lastReceivedAt ?? 0, event.receivedAt),
        status: shouldReactivate ? "active" : existing.status,
        unsubscribeMethod: shouldReactivate ? null : undefined,
        unsubscribeRequestedAt: shouldReactivate ? null : undefined,
        unsubscribedAt: shouldReactivate ? null : undefined,
        updatedAt: now,
      })
      .where(eq(emailSubscriptions.id, existing.id));
  }
}

export async function markEmailSubscriptionStatus(
  db: Database,
  userId: string,
  input: MarkSubscriptionStatusInput,
) {
  const senderKey = buildSubscriptionSenderKey(input.fromAddr);
  const now = Date.now();

  const existing = await db
    .select({
      id: emailSubscriptions.id,
      fromName: emailSubscriptions.fromName,
      emailCount: emailSubscriptions.emailCount,
      lastReceivedAt: emailSubscriptions.lastReceivedAt,
      createdAt: emailSubscriptions.createdAt,
    })
    .from(emailSubscriptions)
    .where(
      and(
        eq(emailSubscriptions.userId, userId),
        eq(emailSubscriptions.senderKey, senderKey),
      ),
    )
    .limit(1);

  const statusFields = {
    status: input.status,
    unsubscribeMethod: input.method ?? null,
    unsubscribeRequestedAt: now,
    unsubscribedAt: input.status === "unsubscribed" ? now : null,
    updatedAt: now,
  } as const;

  if (existing[0]) {
    await db
      .update(emailSubscriptions)
      .set({
        ...statusFields,
        fromAddr: input.fromAddr,
        unsubscribeUrl: input.unsubscribeUrl ?? undefined,
        unsubscribeEmail: input.unsubscribeEmail ?? undefined,
      })
      .where(eq(emailSubscriptions.id, existing[0].id));

    return;
  }

  await db.insert(emailSubscriptions).values({
    userId,
    mailboxId: null,
    senderKey,
    fromAddr: input.fromAddr,
    fromName: null,
    unsubscribeUrl: input.unsubscribeUrl ?? null,
    unsubscribeEmail: input.unsubscribeEmail ?? null,
    emailCount: 1,
    lastReceivedAt: now,
    createdAt: now,
    ...statusFields,
  });
}
