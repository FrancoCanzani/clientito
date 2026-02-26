import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { contacts, customers, emails } from "../../db/schema";
import {
  extractDomainFromEmail,
  normalizeEmailAddress,
} from "../../lib/customer-name";

export async function getCustomerById(
  db: Database,
  id: string,
) {
  return db.query.customers.findFirst({
    where: eq(customers.id, id),
  });
}

type EmailStats = {
  emailCount: number;
  latestEmailDate: number | null;
};

export type LinkedCustomerContact = {
  id: string;
  email: string;
  name: string | null;
  domain: string;
  emailCount: number;
  latestEmailDate: number | null;
  isPrimary: boolean;
};

function toNullableNormalizedEmail(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const normalized = normalizeEmailAddress(value);
  return normalized.length > 0 ? normalized : null;
}

function updateEmailStats(
  stats: Map<string, EmailStats>,
  email: string,
  date: number,
) {
  const current = stats.get(email);
  if (!current) {
    stats.set(email, { emailCount: 1, latestEmailDate: date });
    return;
  }

  stats.set(email, {
    emailCount: current.emailCount + 1,
    latestEmailDate:
      current.latestEmailDate === null
        ? date
        : Math.max(current.latestEmailDate, date),
  });
}

function collectLinkedEmailStats(
  customerEmails: Array<typeof emails.$inferSelect>,
  excludedEmail: string | null,
): Map<string, EmailStats> {
  const stats = new Map<string, EmailStats>();

  for (const message of customerEmails) {
    const addresses = [
      toNullableNormalizedEmail(message.fromAddr),
      toNullableNormalizedEmail(message.toAddr),
    ];

    for (const address of addresses) {
      if (!address) continue;
      if (excludedEmail && address === excludedEmail) continue;
      updateEmailStats(stats, address, message.date);
    }
  }

  return stats;
}

export async function getCustomerContacts(
  db: Database,
  customer: typeof customers.$inferSelect,
  customerEmails: Array<typeof emails.$inferSelect>,
  excludedEmail?: string | null,
): Promise<LinkedCustomerContact[]> {
  const excluded = toNullableNormalizedEmail(excludedEmail);
  const primaryEmail = normalizeEmailAddress(customer.email);
  const stats = collectLinkedEmailStats(customerEmails, excluded);

  const addresses = Array.from(stats.keys());
  if (addresses.length === 0) {
    return [];
  }

  const contactRows = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      name: contacts.name,
      domain: contacts.domain,
    })
    .from(contacts)
    .where(
      and(eq(contacts.orgId, customer.orgId), inArray(contacts.email, addresses)),
    );

  const contactByEmail = new Map(
    contactRows.map((row) => [normalizeEmailAddress(row.email), row]),
  );

  const linked = addresses.map<LinkedCustomerContact>((email) => {
    const contact = contactByEmail.get(email);
    const statsForEmail = stats.get(email)!;
    const isPrimary = email === primaryEmail;

    return {
      id: contact ? String(contact.id) : email,
      email,
      name: contact?.name ?? (isPrimary ? customer.name : null),
      domain: contact?.domain ?? extractDomainFromEmail(email) ?? "",
      emailCount: statsForEmail.emailCount,
      latestEmailDate: statsForEmail.latestEmailDate,
      isPrimary,
    };
  });

  linked.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) {
      return a.isPrimary ? -1 : 1;
    }

    if (a.emailCount !== b.emailCount) {
      return b.emailCount - a.emailCount;
    }

    return a.email.localeCompare(b.email);
  });

  return linked;
}

function emailMatchCondition(
  column: typeof emails.fromAddr | typeof emails.toAddr,
  email: string,
) {
  return sql`lower(${column}) = ${email}`;
}

export async function linkContactToCustomer(
  db: Database,
  input: {
    orgId: string;
    customerId: string;
    email: string;
  },
): Promise<number> {
  const normalizedEmail = normalizeEmailAddress(input.email);
  const linked = await db
    .update(emails)
    .set({
      customerId: input.customerId,
      isCustomer: true,
      classified: true,
    })
    .where(
      and(
        eq(emails.orgId, input.orgId),
        or(
          emailMatchCondition(emails.fromAddr, normalizedEmail),
          emailMatchCondition(emails.toAddr, normalizedEmail),
        ),
        or(isNull(emails.customerId), eq(emails.customerId, input.customerId)),
      ),
    )
    .returning({ id: emails.id });

  return linked.length;
}

export async function unlinkContactFromCustomer(
  db: Database,
  input: {
    orgId: string;
    customerId: string;
    email: string;
  },
): Promise<number> {
  const normalizedEmail = normalizeEmailAddress(input.email);
  const unlinked = await db
    .update(emails)
    .set({
      customerId: null,
      isCustomer: sql<boolean>`case when lower(${emails.fromAddr}) = ${normalizedEmail} then 0 else ${emails.isCustomer} end`,
    })
    .where(
      and(
        eq(emails.orgId, input.orgId),
        eq(emails.customerId, input.customerId),
        or(
          emailMatchCondition(emails.fromAddr, normalizedEmail),
          emailMatchCondition(emails.toAddr, normalizedEmail),
        ),
      ),
    )
    .returning({ id: emails.id });

  return unlinked.length;
}
