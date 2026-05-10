import { fetchSearchEmails } from "@/features/email/mail/data/search";

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

 const response = await fetchSearchEmails({ q: query, mailboxId });

 return response.emails.slice(0, 10).map((email) => ({
 id: String(email.id),
 label: email.subject || "(no subject)",
 description: email.fromName ?? email.fromAddr ?? null,
 emailId: String(email.id),
 mailboxId: email.mailboxId,
 }));
}
