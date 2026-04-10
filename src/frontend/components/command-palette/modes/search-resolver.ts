import { fetchSearchEmails } from "@/features/email/inbox/queries";

export type SearchResult = {
  id: string;
  label: string;
  description: string | null;
  emailId: string;
  mailboxId: number | null;
};

export async function resolveSearch(
  query: string,
  mailboxId?: number,
): Promise<SearchResult[]> {
  if (query.length < 2) return [];

  const response = await fetchSearchEmails({ q: query, limit: 10, mailboxId });

  return response.data.map((email) => ({
    id: String(email.id),
    label: email.subject || "(no subject)",
    description: email.fromName ?? email.fromAddr ?? null,
    emailId: String(email.id),
    mailboxId: email.mailboxId,
  }));
}
