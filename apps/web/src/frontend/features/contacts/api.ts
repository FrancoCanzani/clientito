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

export type ContactsListResponse = {
  data: Contact[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

export type CreateCustomersFromContactsResult = {
  customersCreated: number;
  emailsLinked: number;
};

type DataResponse<T> = { data: T };

export async function fetchContacts(
  orgId: string,
  search?: string,
  params?: { domain?: string; limit?: number; offset?: number },
): Promise<Contact[]> {
  const result = await fetchContactsPaginated(orgId, search, params);
  return result.data;
}

export async function fetchContactsPaginated(
  orgId: string,
  search?: string,
  params?: { domain?: string; limit?: number; offset?: number },
): Promise<ContactsListResponse> {
  const query = new URLSearchParams({ orgId });
  if (search) query.set("search", search);
  if (params?.domain) query.set("domain", params.domain);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const response = await apiFetch(`/contacts?${query.toString()}`);
  return response.json();
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
