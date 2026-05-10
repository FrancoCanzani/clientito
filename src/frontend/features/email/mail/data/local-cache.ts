import { localDb, type EmailInsert } from "@/db/client";
import { gatekeeperQueryKeys } from "@/features/email/gatekeeper/query-keys";
import type { EmailListItem } from "@/features/email/mail/types";
import { prepareEmailHtml } from "@/features/email/mail/utils/prepare-email-html";
import { queryClient } from "@/lib/query-client";
import { enqueueClassificationTasks } from "./classification";
import type { PulledEmail } from "./types";

const ACTIVE_USER_KEY = "active-user-id";

const CALENDAR_MIME_PREFIXES = [
  "text/calendar",
  "application/ics",
  "application/icalendar",
  "application/x-ical",
  "application/vnd.ms-outlook",
] as const;
const CALENDAR_BODY_MARKERS = [
  "begin:vcalendar",
  "begin:vevent",
  "method:request",
  "method:cancel",
  "method:reply",
] as const;

type GatekeeperTrustLevel = "trusted" | "blocked" | null;

function hasCalendarMime(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return CALENDAR_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function hasCalendarFilename(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.trim().toLowerCase().endsWith(".ics");
}

function hasCalendarBodySignal(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return CALENDAR_BODY_MARKERS.some((marker) => normalized.includes(marker));
}

function inferHasCalendar(email: PulledEmail): boolean {
  if (email.hasCalendar === true) return true;
  if (
    email.attachments?.some(
      (attachment) =>
        hasCalendarMime(attachment.mimeType) ||
        hasCalendarFilename(attachment.filename),
    )
  ) {
    return true;
  }
  return (
    hasCalendarBodySignal(email.bodyText) ||
    hasCalendarBodySignal(email.bodyHtml)
  );
}

function normalizeSender(fromAddr: string | null | undefined): string | null {
  if (!fromAddr) return null;
  const normalized = fromAddr.trim().toLowerCase();
  if (!normalized) return null;
  const bracketMatch = normalized.match(/<([^>]+)>/);
  const candidate = bracketMatch?.[1]?.trim() ?? normalized;
  const emailMatch = candidate.match(/[^\s<>()"'`,;:]+@[^\s<>()"'`,;:]+/);
  if (!emailMatch) return null;
  return emailMatch[0].toLowerCase();
}

function gatekeeperActivatedAtKey(mailboxId: number): string {
  return `gatekeeperActivatedAt:${mailboxId}`;
}

async function resolveGatekeeperActivatedAt(
  mailboxId: number,
): Promise<number> {
  const key = gatekeeperActivatedAtKey(mailboxId);
  const raw = await localDb.getMeta(key);
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;

  const now = Date.now();
  await localDb.setMeta(key, String(now));
  return now;
}

async function resolveGatekeeperTrust(
  pulled: PulledEmail[],
  mailboxId: number,
  userId: string,
  gatekeeperActivatedAt: number,
): Promise<Map<string, GatekeeperTrustLevel>> {
  const receivedInboxSenders = Array.from(
    new Set(
      pulled
        .filter(
          (email) =>
            email.direction === "received" && email.labelIds.includes("INBOX"),
        )
        .map((email) => normalizeSender(email.fromAddr))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (receivedInboxSenders.length === 0) return new Map();

  const map = new Map<string, GatekeeperTrustLevel>();
  let serverResolveFailed = false;

  try {
    const response = await fetch("/api/inbox/gatekeeper/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mailboxId,
        senders: receivedInboxSenders,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      data?: {
        trust?: Array<{
          sender: string;
          trustLevel: GatekeeperTrustLevel;
        }>;
      };
    } | null;

    const trust = payload?.data?.trust;
    if (!response.ok || !Array.isArray(trust)) {
      serverResolveFailed = true;
    } else {
      const serverResolved = new Map(
        trust
          .map(
            (entry) =>
              [normalizeSender(entry.sender), entry.trustLevel] as const,
          )
          .filter(
            (entry): entry is [string, GatekeeperTrustLevel] =>
              typeof entry[0] === "string",
          ),
      );
      for (const [sender, trustLevel] of serverResolved) {
        if (trustLevel !== null) map.set(sender, trustLevel);
      }
    }
  } catch {
    serverResolveFailed = true;
  }

  try {
    const knownSenders = await localDb.getKnownSenders({
      userId,
      mailboxId,
      gatekeeperActivatedAt,
      senders: receivedInboxSenders,
    });
    for (const sender of knownSenders) {
      if (!map.has(sender)) {
        map.set(sender, "trusted");
      }
    }
  } catch {
    // Ignore fallback errors.
  }

  if (serverResolveFailed) {
    for (const sender of receivedInboxSenders) {
      if (!map.has(sender)) {
        map.set(sender, "trusted");
      }
    }
  }

  return map;
}

function pulledToRow(
  email: PulledEmail,
  userId: string,
  mailboxId: number,
  senderTrust: GatekeeperTrustLevel,
  gatekeeperActivatedAt: number,
): EmailInsert {
  const labels = new Set(email.labelIds);
  if (senderTrust === "blocked") {
    labels.delete("INBOX");
    labels.delete("UNREAD");
    labels.add("TRASH");
  }
  const labelIds = Array.from(labels);
  const isGatekept =
    senderTrust === null &&
    email.direction === "received" &&
    labels.has("INBOX") &&
    email.date >= gatekeeperActivatedAt;

  return {
    userId,
    mailboxId,
    providerMessageId: email.providerMessageId,
    fromAddr: email.fromAddr,
    fromName: email.fromName,
    toAddr: email.toAddr,
    ccAddr: email.ccAddr,
    subject: email.subject,
    snippet: email.snippet,
    threadId: email.threadId,
    date: email.date,
    direction: email.direction,
    isRead: email.isRead,
    labelIds: JSON.stringify(labelIds),
    hasInbox: labelIds.includes("INBOX"),
    hasSent: labelIds.includes("SENT"),
    hasTrash: labelIds.includes("TRASH"),
    hasSpam: labelIds.includes("SPAM"),
    hasStarred: labelIds.includes("STARRED"),
    unsubscribeUrl: email.unsubscribeUrl,
    unsubscribeEmail: email.unsubscribeEmail,
    snoozedUntil: null,
    bodyText: email.bodyText,
    bodyHtml: email.bodyHtml
      ? prepareEmailHtml(
          email.bodyHtml,
          email.inlineAttachments && email.inlineAttachments.length > 0
            ? {
                providerMessageId: email.providerMessageId,
                mailboxId,
                attachments: email.inlineAttachments,
              }
            : null,
        )
      : null,
    inlineAttachments:
      email.inlineAttachments && email.inlineAttachments.length > 0
        ? JSON.stringify(email.inlineAttachments)
        : null,
    attachments:
      email.attachments && email.attachments.length > 0
        ? JSON.stringify(email.attachments)
        : null,
    hasCalendar: inferHasCalendar(email),
    isGatekept,
    aiCategory: null,
    aiConfidence: null,
    aiReason: null,
    aiSummary: null,
    aiDraftReply: null,
    aiClassifiedAt: null,
    aiClassificationKey: null,
    aiSplitIds: null,
    createdAt: email.date,
  };
}

export async function alignActiveUser(userId: string): Promise<void> {
  await localDb.ensureReady();
  const active = await localDb.getMeta(ACTIVE_USER_KEY);
  if (active && active !== userId) {
    await localDb.clear();
  }
  if (active !== userId) {
    await localDb.setMeta(ACTIVE_USER_KEY, userId);
  }
}

export async function persistEmails(
  pulled: PulledEmail[],
  userId: string,
  mailboxId: number,
): Promise<EmailListItem[]> {
  if (pulled.length === 0) return [];
  const gatekeeperActivatedAt = await resolveGatekeeperActivatedAt(mailboxId);
  const trustBySender = await resolveGatekeeperTrust(
    pulled,
    mailboxId,
    userId,
    gatekeeperActivatedAt,
  );
  const rows = pulled.map((e) =>
    pulledToRow(
      e,
      userId,
      mailboxId,
      trustBySender.get(normalizeSender(e.fromAddr) ?? "") ?? null,
      gatekeeperActivatedAt,
    ),
  );
  await localDb.insertEmails(rows);
  void queryClient.invalidateQueries({
    queryKey: gatekeeperQueryKeys.pending(mailboxId),
  });
  const providerIds = pulled.map((e) => e.providerMessageId);
  const hydrated = await localDb.getEmailsByProviderMessageIds(
    userId,
    providerIds,
  );
  const byProviderId = new Map(hydrated.map((r) => [r.providerMessageId, r]));
  enqueueClassificationTasks(pulled, userId, mailboxId);
  return providerIds
    .map((id) => byProviderId.get(id))
    .filter((e): e is NonNullable<typeof e> => e !== undefined);
}
