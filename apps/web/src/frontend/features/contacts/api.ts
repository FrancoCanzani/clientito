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

  const response = await fetch(`/api/contacts?${query}`, {
    credentials: "include",
  });
  return response.json();
}

export async function createCustomersFromContacts(
  orgId: string,
  emails: string[],
): Promise<CreateCustomersFromContactsResult> {
  const response = await fetch("/api/contacts", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId, emails }),
  });
  const json = await response.json();
  return json.data;
}
