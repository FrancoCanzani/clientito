import { sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { contacts } from "../db/schema";
import {
  extractDomainFromEmail,
  normalizeEmailAddress,
  sanitizeCandidateName,
} from "./customer-name";

export function parseEmailHeader(raw: string): {
  name: string | null;
  email: string;
  domain: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const addressMatch = trimmed.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (!addressMatch) return null;
  const email = normalizeEmailAddress(addressMatch[0]);
  if (!email) return null;

  let name: string | null = null;
  const displayMatch = trimmed.match(/^(.+?)\s*</);
  if (displayMatch) {
    name = displayMatch[1].replace(/^["']|["']$/g, "").trim() || null;
  }

  const domain = extractDomainFromEmail(email);
  if (!domain) return null;

  return {
    name: sanitizeCandidateName(name, email),
    email,
    domain,
  };
}

export async function upsertContact(
  db: Database,
  orgId: string,
  rawHeaderValue: string,
  emailDate: number,
): Promise<void> {
  const parsed = parseEmailHeader(rawHeaderValue);
  if (!parsed) return;

  const now = Date.now();

  await db
    .insert(contacts)
    .values({
      orgId,
      email: parsed.email,
      name: parsed.name,
      domain: parsed.domain,
      emailCount: 1,
      latestEmailDate: emailDate,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [contacts.orgId, contacts.email],
      set: {
        emailCount: sql`${contacts.emailCount} + 1`,
        latestEmailDate: sql`max(${contacts.latestEmailDate}, ${emailDate})`,
        name: sql`coalesce(${contacts.name}, ${parsed.name})`,
        updatedAt: now,
      },
    });
}
