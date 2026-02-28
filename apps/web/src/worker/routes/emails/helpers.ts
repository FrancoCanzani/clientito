export function normalizeEmailAddress(input: string): string {
  return input.trim().toLowerCase();
}

export function toEmailListResponse(row: {
  id: string;
  gmailId: string;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  threadId: string | null;
  date: number;
  isRead: boolean;
  labelIds: string[] | null;
  isCustomer: boolean;
  classified: boolean;
  createdAt: number;
  customerId: string | null;
  customerName: string | null;
}) {
  const labelIds = row.labelIds ?? [];

  return {
    id: String(row.id),
    gmailId: row.gmailId,
    fromAddr: row.fromAddr,
    fromName: row.fromName,
    toAddr: row.toAddr,
    subject: row.subject,
    snippet: row.snippet,
    bodyText: row.bodyText,
    bodyHtml: row.bodyHtml,
    threadId: row.threadId,
    date: row.date,
    isRead: row.isRead,
    labelIds,
    hasAttachment: labelIds.includes("HAS_ATTACHMENT"),
    isCustomer: row.isCustomer,
    classified: row.classified,
    createdAt: row.createdAt,
    customerId: row.customerId ? String(row.customerId) : null,
    customerName: row.customerName ?? null,
  };
}

export function toEmailSearchResponse(row: {
  id: string;
  gmailId: string;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  subject: string | null;
  snippet: string | null;
  date: number;
  isRead: boolean;
  labelIds: string[] | null;
  isCustomer: boolean;
  customerId: string | null;
  customerName: string | null;
}) {
  return {
    id: String(row.id),
    gmailId: row.gmailId,
    fromAddr: row.fromAddr,
    fromName: row.fromName,
    toAddr: row.toAddr,
    subject: row.subject,
    snippet: row.snippet,
    date: row.date,
    isRead: row.isRead,
    labelIds: row.labelIds ?? [],
    isCustomer: row.isCustomer,
    customerId: row.customerId ? String(row.customerId) : null,
    customerName: row.customerName ?? null,
  };
}
