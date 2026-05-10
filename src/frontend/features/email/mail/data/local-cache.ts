import { localDb, type EmailInsert } from "@/db/client";
import { resolveGatekeeperActivatedAt } from "@/features/email/gatekeeper/lib/gatekeeper-activated-at";
import { gatekeeperQueryKeys } from "@/features/email/gatekeeper/query-keys";
import type { EmailListItem } from "@/features/email/mail/types";
import { prepareEmailHtml } from "@/features/email/mail/utils/prepare-email-html";
import { hasCalendarBodySignal, isCalendarFilename, isCalendarMimeType, normalizeEmailAddress } from "@/lib/email";
import { queryClient } from "@/lib/query-client";
import type { PulledEmail } from "./types";

const ACTIVE_USER_KEY = "active-user-id";

type GatekeeperTrustLevel = "trusted" | "blocked" | null;

function inferHasCalendar(email: PulledEmail): boolean {
  if (email.hasCalendar === true) return true;
  if (
    email.attachments?.some(
      (attachment) =>
        isCalendarMimeType(attachment.mimeType) ||
        isCalendarFilename(attachment.filename),
    )
  ) {
    return true;
  }
  return (
    hasCalendarBodySignal(email.bodyText) ||
    hasCalendarBodySignal(email.bodyHtml)
  );
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
        .map((email) => normalizeEmailAddress(email.fromAddr))
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
              [normalizeEmailAddress(entry.sender), entry.trustLevel] as const,
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
    aiSummary: null,
    aiDraftReply: null,
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
      trustBySender.get(normalizeEmailAddress(e.fromAddr) ?? "") ?? null,
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
  return providerIds
    .map((id) => byProviderId.get(id))
    .filter((e): e is NonNullable<typeof e> => e !== undefined);
}
