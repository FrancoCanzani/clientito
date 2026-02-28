export type EmailSearchResult = {
  id: string;
  gmailId: string;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  subject: string | null;
  snippet: string | null;
  date: number;
  isRead: boolean;
  labelIds: string[];
  isCustomer: boolean;
  customerId: string | null;
  customerName: string | null;
};

export type EmailListItem = {
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
  labelIds: string[];
  hasAttachment: boolean;
  isCustomer: boolean;
  classified: boolean;
  createdAt: number;
  customerId: string | null;
  customerName: string | null;
};

export type EmailAttachment = {
  attachmentId: string;
  filename: string | null;
  mimeType: string | null;
  size: number | null;
  contentId: string | null;
  isInline: boolean;
  isImage: boolean;
  downloadUrl: string;
  inlineUrl: string | null;
};

export type EmailDetailItem = EmailListItem & {
  resolvedBodyText: string | null;
  resolvedBodyHtml: string | null;
  attachments: EmailAttachment[];
};

export type EmailListResponse = {
  data: EmailListItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

export type EmailAnalysis = {
  summary: string;
  sentiment: "positive" | "neutral" | "negative" | "urgent";
  suggestedTasks: Array<{ message: string; dueInDays: number }>;
  language: string;
  translation: string | null;
};

export type ActionableEmail = {
  id: string;
  fromAddr: string;
  fromName: string | null;
  subject: string | null;
  customerId: string | null;
  customerName: string | null;
};

export async function searchEmails(
  orgId: string,
  q: string,
): Promise<EmailSearchResult[]> {
  const params = new URLSearchParams({ orgId, q });
  const response = await fetch(`/api/emails/search?${params}`, {
    credentials: "include",
  });
  const json = await response.json();
  return json.data;
}

export async function fetchEmails(
  orgId: string,
  params?: {
    search?: string;
    customerId?: string;
    isCustomer?: "true" | "false";
    isRead?: "true" | "false";
    category?: "primary" | "promotions" | "social" | "notifications";
    limit?: number;
    offset?: number;
  },
): Promise<EmailListResponse> {
  const query = new URLSearchParams({ orgId });
  if (params?.search) query.set("search", params.search);
  if (params?.customerId) query.set("customerId", params.customerId);
  if (params?.isCustomer) query.set("isCustomer", params.isCustomer);
  if (params?.isRead) query.set("isRead", params.isRead);
  if (params?.category) query.set("category", params.category);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const response = await fetch(`/api/emails?${query}`, {
    credentials: "include",
  });
  return response.json();
}

export async function fetchEmailDetail(
  orgId: string,
  emailId: string,
  options?: { skipLive?: boolean },
): Promise<EmailDetailItem> {
  const params = new URLSearchParams({ orgId, emailId });
  if (options?.skipLive) {
    params.set("skipLive", "true");
  }
  const response = await fetch(`/api/emails/detail?${params}`, {
    credentials: "include",
  });
  const json = await response.json();
  return json.data;
}

export async function analyzeEmail(
  orgId: string,
  emailId: string,
): Promise<EmailAnalysis> {
  const params = new URLSearchParams({ orgId, emailId });
  const response = await fetch(`/api/emails/analyze?${params}`, {
    credentials: "include",
  });
  const json = await response.json();
  return json.data;
}

export async function fetchActionableEmails(
  orgId: string,
  since: number,
): Promise<ActionableEmail[]> {
  const params = new URLSearchParams({ orgId, since: String(since) });
  const response = await fetch(`/api/emails/actionable?${params}`, {
    credentials: "include",
  });
  const json = await response.json();
  return json.data;
}

export async function markAsCustomer(
  orgId: string,
  emailAddress: string,
  opts?: { name?: string; company?: string },
): Promise<{ customerId: string; emailsLinked: number }> {
  const response = await fetch("/api/emails/mark-customer", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId, emailAddress, ...opts }),
  });
  const json = await response.json();
  return json.data;
}
