import { fetchContactSuggestions } from "@/features/email/mail/data/contacts";
import type { ContactSuggestion } from "@/features/email/mail/types";

export type PeopleResult = {
  id: string;
  label: string;
  description: string | null;
  email: string;
};

export async function resolvePeople(query: string): Promise<PeopleResult[]> {
  if (query.length < 2) return [];

  const contacts: ContactSuggestion[] = await fetchContactSuggestions(
    query,
    10,
  );

  return contacts.map((c) => ({
    id: c.email,
    label: c.name ?? c.email,
    description: c.name ? c.email : null,
    email: c.email,
  }));
}
