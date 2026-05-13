import { localDb, type EmailInsert } from "@/db/client";
import { resolveGatekeeperActivatedAt } from "@/features/email/gatekeeper/lib/gatekeeper-activated-at";
import { gatekeeperQueryKeys } from "@/features/email/gatekeeper/query-keys";
import type { EmailListItem } from "@/features/email/mail/types";
import { prepareEmailHtml } from "@/features/email/mail/utils/prepare-email-html";
import {
  hasCalendarBodySignal,
  isCalendarFilename,
  isCalendarMimeType,
  normalizeEmailAddress,
} from "@/lib/email";
import { queryClient } from "@/lib/query-client";
import type { PulledEmail } from "./types";

const ACTIVE_USER_KEY = "active-user-id";
let cachedActiveUser: string | undefined;

type GatekeeperTrustLevel = "trusted" | "blocked" | null;

function inferHasCalendar(email: PulledEmail): boolean {
  if (email.hasCalendar === true) return true;
  if (
    email.attachments?.some(
      (a) => isCalendarMimeType(a.mimeType) || isCalendarFilename(a.filename),
    )
  )
    return true;
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
  const senders: string[] = Array.from(
    new Set(
      pulled
        .filter(
          (e) => e.direction === "received" && e.labelIds.includes("INBOX"),
        )
        .map((e) => normalizeEmailAddress(e.fromAddr))
        .filter((s): s is string => s !== null),
    ),
  );
  if (senders.length === 0) return new Map();

  const map = new Map<string, GatekeeperTrustLevel>();

  // Race the server resolve against the local known-senders lookup; the local
  // call no longer waits behind a slow/flaky network round-trip.
  const serverPromise = fetch("/api/inbox/gatekeeper/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mailboxId, senders }),
  })
    .then(async (res) => {
      const payload = (await res.json().catch(() => null)) as {
        data?: {
          trust?: Array<{ sender: string; trustLevel: GatekeeperTrustLevel }>;
        };
      } | null;
      const trust = payload?.data?.trust;
      if (!res.ok || !Array.isArray(trust)) return null;
      return trust;
    })
    .catch(() => null);

  const localPromise = localDb
    .getKnownSenders({ userId, mailboxId, gatekeeperActivatedAt, senders })
    .catch(() => [] as string[]);

  const [serverTrust, knownLocal] = await Promise.all([
    serverPromise,
    localPromise,
  ]);

  if (serverTrust) {
    for (const { sender, trustLevel } of serverTrust) {
      const normalized = normalizeEmailAddress(sender);
      if (normalized && trustLevel !== null) map.set(normalized, trustLevel);
    }
  }
  for (const s of knownLocal) {
    if (!map.has(s)) map.set(s, "trusted");
  }
  if (!serverTrust) {
    for (const s of senders) {
      if (!map.has(s)) map.set(s, "trusted");
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
    bodyHtml: email.bodyHtml,
    preparedBodyHtml: email.bodyHtml
      ? prepareEmailHtml(
          email.bodyHtml,
          email.inlineAttachments?.length
            ? {
                providerMessageId: email.providerMessageId,
                mailboxId,
                attachments: email.inlineAttachments,
              }
            : null,
        )
      : null,
    inlineAttachments: email.inlineAttachments?.length
      ? JSON.stringify(email.inlineAttachments)
      : null,
    attachments: email.attachments?.length
      ? JSON.stringify(email.attachments)
      : null,
    hasCalendar: inferHasCalendar(email),
    isGatekept,
    createdAt: email.date,
  };
}

export function invalidateActiveUserCache(): void {
  cachedActiveUser = undefined;
}

export async function alignActiveUser(userId: string): Promise<void> {
  await localDb.ensureReady();
  if (cachedActiveUser === userId) return;
  const active = await localDb.getMeta(ACTIVE_USER_KEY);
  if (active && active !== userId) {
    await localDb.clear();
    cachedActiveUser = undefined;
  }
  if (active !== userId) {
    await localDb.setMeta(ACTIVE_USER_KEY, userId);
  }
  cachedActiveUser = userId;
}

export async function persistEmails(
  pulled: PulledEmail[],
  userId: string,
  mailboxId: number,
  options?: {
    returnHydrated?: boolean;
    /** KV pairs UPSERTed into `_meta` atomically with the last chunk. */
    meta?: Record<string, string>;
  },
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

  await localDb.insertEmails(rows, { meta: options?.meta });

  void queryClient.invalidateQueries({
    queryKey: gatekeeperQueryKeys.pending(mailboxId),
  });

  // Most callers invalidate queries instead of consuming the return value, so
  // we skip the second round-trip unless explicitly opted in.
  if (!options?.returnHydrated) return [];
  const providerIds = pulled.map((e) => e.providerMessageId);
  return localDb.getEmailsByProviderMessageIds(userId, mailboxId, providerIds);
}
