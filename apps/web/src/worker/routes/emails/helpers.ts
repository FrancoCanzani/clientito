export function normalizeEmailAddress(input: string): string {
  return input.trim().toLowerCase();
}

export function toEmailSearchResponse(row: {
  id: string;
  gmailId: string;
  fromAddr: string;
  toAddr: string | null;
  subject: string | null;
  snippet: string | null;
  date: number;
  isCustomer: boolean;
  customerId: string | null;
  customerName: string | null;
}) {
  return {
    id: String(row.id),
    gmailId: row.gmailId,
    fromAddr: row.fromAddr,
    toAddr: row.toAddr,
    subject: row.subject,
    snippet: row.snippet,
    date: row.date,
    isCustomer: row.isCustomer,
    customerId: row.customerId ? String(row.customerId) : null,
    customerName: row.customerName ?? null,
  };
}
