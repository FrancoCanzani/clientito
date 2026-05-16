import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import type { ContactSuggestion } from "@/features/email/mail/shared/types";
import { persistEmails } from "@/features/email/mail/shared/data/local-cache";
import { dedup } from "@/features/email/mail/shared/data/request-dedup";
import type { PulledEmail } from "@/features/email/mail/shared/data/types";

function contactSuggestionRefreshKey(q: string, mailboxId: number): string {
  return `contact-refresh:${mailboxId}:${q.trim().toLowerCase()}`;
}

function buildContactSuggestionSearchQuery(q: string): string {
  const cleaned = q.trim().replace(/["\\]/g, " ").replace(/\s+/g, " ");
  if (!cleaned) return q;
  return `${cleaned} OR from:${cleaned} OR to:${cleaned} OR cc:${cleaned}`;
}

function mergeContactSuggestions(
  primary: ContactSuggestion[],
  secondary: ContactSuggestion[],
  limit: number,
): ContactSuggestion[] {
  const byEmail = new Map<string, ContactSuggestion>();
  for (const item of [...primary, ...secondary]) {
    const key = item.email.trim().toLowerCase();
    if (!key || byEmail.has(key)) continue;
    byEmail.set(key, item);
  }
  return Array.from(byEmail.values()).slice(0, limit);
}

export async function fetchContactSuggestions(
  q: string,
  limit = 8,
  mailboxId?: number,
): Promise<ContactSuggestion[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const normalizedQuery = q.trim();
  const local = await localDb.getContactSuggestions(
    userId,
    normalizedQuery,
    mailboxId,
    limit,
  );
  if (!mailboxId || normalizedQuery.length < 2) return local;

  const remoteRefresh = dedup(
    contactSuggestionRefreshKey(normalizedQuery, mailboxId),
    async () => {
      const response = await fetch("/api/inbox/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailboxId,
          q: buildContactSuggestionSearchQuery(normalizedQuery),
          includeJunk: true,
        }),
      });
      if (!response.ok) return;
      const body = (await response.json()) as { emails?: PulledEmail[] };
      if (body.emails?.length) {
        await persistEmails(body.emails, userId, mailboxId);
      }
    },
  ).catch(() => {});

  if (local.length >= limit) return local;

  await remoteRefresh;
  const refreshed = await localDb.getContactSuggestions(
    userId,
    normalizedQuery,
    mailboxId,
    limit,
  );
  return mergeContactSuggestions(local, refreshed, limit);
}
