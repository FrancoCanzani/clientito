import { apiFetch } from "@/lib/api";

export type Contact = {
  id: string;
  email: string;
  name: string | null;
  domain: string;
  emailCount: number;
  latestEmailDate: number | null;
  isAlreadyCustomer: boolean;
};

export type CreateCustomersFromContactsResult = {
  customersCreated: number;
  emailsLinked: number;
};

type DataResponse<T> = { data: T };

export async function fetchContacts(
  orgId: string,
  search?: string,
): Promise<Contact[]> {
  const query = new URLSearchParams({ orgId });
  if (search) query.set("search", search);

  const response = await apiFetch(`/contacts?${query.toString()}`);
  const json: DataResponse<Contact[]> = await response.json();
  return json.data;
}

export async function createCustomersFromContacts(
  orgId: string,
  emails: string[],
): Promise<CreateCustomersFromContactsResult> {
  const response = await apiFetch("/contacts", {
    method: "POST",
    body: JSON.stringify({ orgId, emails }),
  });
  const json: DataResponse<CreateCustomersFromContactsResult> =
    await response.json();
  return json.data;
}
