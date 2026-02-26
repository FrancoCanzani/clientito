import { emails, reminders } from "../../db/schema";

export function toCustomerResponse(record: {
  id: string;
  orgId: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  vatEin: string | null;
  address: string | null;
  notes: string;
  createdAt: number;
  updatedAt: number;
}) {
  return {
    id: String(record.id),
    orgId: String(record.orgId),
    name: record.name,
    company: record.company ?? null,
    email: record.email,
    phone: record.phone ?? null,
    website: record.website ?? null,
    vatEin: record.vatEin ?? null,
    address: record.address ?? null,
    notes: record.notes,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toCustomerEmailResponse(record: typeof emails.$inferSelect) {
  return {
    id: String(record.id),
    orgId: String(record.orgId),
    gmailId: record.gmailId,
    threadId: record.threadId ?? null,
    customerId: record.customerId ? String(record.customerId) : null,
    fromAddr: record.fromAddr,
    toAddr: record.toAddr ?? null,
    subject: record.subject ?? null,
    snippet: record.snippet ?? null,
    bodyText: record.bodyText ?? null,
    date: record.date,
    isCustomer: record.isCustomer,
    classified: record.classified,
    createdAt: record.createdAt,
  };
}

export function toCustomerReminderResponse(
  record: typeof reminders.$inferSelect,
) {
  return {
    id: String(record.id),
    orgId: String(record.orgId),
    customerId: String(record.customerId),
    userId: record.userId,
    message: record.message,
    dueAt: record.dueAt,
    done: record.done,
    createdAt: record.createdAt,
  };
}
