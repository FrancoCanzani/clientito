import { apiFetch } from "@/lib/api";

export type CustomerHealthSummary = {
  status: "healthy" | "at_risk" | "churned" | "new" | "unknown";
  keyChanges: string[];
  risks: string[];
  nextBestAction: string;
  confidence: number;
  generatedAt: number;
  triggerReason: string | null;
};

export type CustomerListItem = {
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
  emailCount: number;
  latestEmailDate: number | null;
  pendingRemindersCount: number;
  summaryStatus: string | null;
};

export type CustomerListResponse = {
  data: CustomerListItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

export type Task = {
  id: string;
  orgId: string;
  customerId: string;
  userId: string;
  message: string;
  dueAt: number;
  done: boolean;
  createdAt: number;
};

export type CustomerContact = {
  id: string;
  email: string;
  name: string | null;
  domain: string;
  emailCount: number;
  latestEmailDate: number | null;
  isPrimary: boolean;
};

export type CustomerEmail = {
  id: string;
  gmailId: string;
  fromAddr: string;
  toAddr: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  date: number;
  isCustomer: boolean;
  customerId: string | null;
};

export type CustomerDetail = {
  customer: CustomerListItem;
  emails: CustomerEmail[];
  reminders: Task[];
  contacts: CustomerContact[];
};

type DataResponse<T> = { data: T };

export async function fetchCustomers(
  orgId: string,
  params?: { search?: string; limit?: number; offset?: number },
): Promise<CustomerListResponse> {
  const query = new URLSearchParams({ orgId });
  if (params?.search) query.set("search", params.search);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const response = await apiFetch(`/customers?${query.toString()}`);
  const json: CustomerListResponse = await response.json();
  return json;
}

export async function fetchCustomerSummary(
  customerId: string,
): Promise<CustomerHealthSummary | null> {
  const response = await apiFetch(`/customers/${customerId}/summary`);
  const json: DataResponse<CustomerHealthSummary | null> = await response.json();
  return json.data;
}

export async function fetchCustomerDetail(id: string): Promise<CustomerDetail> {
  const response = await apiFetch(`/customers/${id}`);
  const json: DataResponse<CustomerDetail> = await response.json();
  return json.data;
}

export async function createCustomer(input: {
  orgId: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  website?: string;
  vatEin?: string;
  address?: string;
  notes?: string;
}): Promise<CustomerListItem> {
  const response = await apiFetch("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const json: DataResponse<CustomerListItem> = await response.json();
  return json.data;
}

export async function updateCustomer(
  id: string,
  updates: {
    name?: string;
    company?: string | null;
    phone?: string | null;
    website?: string | null;
    vatEin?: string | null;
    address?: string | null;
    notes?: string;
  },
): Promise<void> {
  await apiFetch(`/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function addCustomerContact(
  customerId: string,
  email: string,
): Promise<{ email: string; emailsLinked: number }> {
  const response = await apiFetch(`/customers/${customerId}/contacts`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  const json: DataResponse<{ email: string; emailsLinked: number }> =
    await response.json();
  return json.data;
}

export async function removeCustomerContact(
  customerId: string,
  email: string,
): Promise<{ email: string; emailsLinked: number }> {
  const response = await apiFetch(
    `/customers/${customerId}/contacts/${encodeURIComponent(email)}`,
    {
      method: "DELETE",
    },
  );
  const json: DataResponse<{ email: string; emailsLinked: number }> =
    await response.json();
  return json.data;
}

export async function createTask(input: {
  orgId: string;
  customerId: string;
  message: string;
  dueAt: number;
}): Promise<Task> {
  const response = await apiFetch("/reminders", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const json: DataResponse<Task> = await response.json();
  return json.data;
}

export async function updateTask(
  id: string,
  updates: { message?: string; dueAt?: number; done?: boolean },
): Promise<Task> {
  const response = await apiFetch(`/reminders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  const json: DataResponse<Task> = await response.json();
  return json.data;
}

export async function deleteTask(id: string): Promise<void> {
  await apiFetch(`/reminders/${id}`, { method: "DELETE" });
}
