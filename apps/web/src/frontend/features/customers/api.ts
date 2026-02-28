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

export async function fetchCustomers(
  orgId: string,
  params?: {
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: "name" | "activity" | "emails";
    order?: "asc" | "desc";
  },
): Promise<CustomerListResponse> {
  const query = new URLSearchParams({ orgId });
  if (params?.search) query.set("search", params.search);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  if (params?.sortBy) query.set("sortBy", params.sortBy);
  if (params?.order) query.set("order", params.order);

  const response = await fetch(`/api/customers?${query}`, {
    credentials: "include",
  });
  return response.json();
}

export async function fetchCustomerSummary(
  customerId: string,
): Promise<CustomerHealthSummary | null> {
  const response = await fetch(`/api/customers/${customerId}/summary`, {
    credentials: "include",
  });
  const json = await response.json();
  return json.data;
}

export async function fetchCustomerDetail(
  id: string,
): Promise<CustomerDetail> {
  const response = await fetch(`/api/customers/${id}`, {
    credentials: "include",
  });
  const json = await response.json();
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
  const response = await fetch("/api/customers", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await response.json();
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
  await fetch(`/api/customers/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export async function addCustomerContact(
  customerId: string,
  email: string,
): Promise<{ email: string; emailsLinked: number }> {
  const response = await fetch(`/api/customers/${customerId}/contacts`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const json = await response.json();
  return json.data;
}

export async function removeCustomerContact(
  customerId: string,
  email: string,
): Promise<{ email: string; emailsLinked: number }> {
  const response = await fetch(
    `/api/customers/${customerId}/contacts/${encodeURIComponent(email)}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );
  const json = await response.json();
  return json.data;
}

export async function createTask(input: {
  orgId: string;
  customerId: string;
  message: string;
  dueAt: number;
}): Promise<Task> {
  const response = await fetch("/api/reminders", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await response.json();
  return json.data;
}

export async function updateTask(
  id: string,
  updates: { message?: string; dueAt?: number; done?: boolean },
): Promise<Task> {
  const response = await fetch(`/api/reminders/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const json = await response.json();
  return json.data;
}

export async function deleteTask(id: string): Promise<void> {
  await fetch(`/api/reminders/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
}
