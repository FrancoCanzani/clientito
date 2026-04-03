export type ContactSuggestion = {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  lastInteractionAt: number | null;
  interactionCount: number;
};

export type InboxSearchScope = {
  q: string;
  mailboxId?: number;
  view?: "inbox" | "sent" | "spam" | "trash" | "snoozed" | "archived" | "starred" | "important";
  includeJunk?: boolean;
};

export type InboxSearchFilterSuggestion = {
  kind: "filter";
  id: string;
  label: string;
  query: string;
  description: string | null;
};

export type InboxSearchContactSuggestion = ContactSuggestion & {
  kind: "contact";
  id: string;
  label: string;
  query: string;
  description: string | null;
};

export type InboxSearchSubjectSuggestion = {
  kind: "subject";
  id: string;
  label: string;
  query: string;
  subject: string;
  description: string | null;
  lastUsedAt: number | null;
};

export type InboxSearchSuggestionsResponse = {
  filters: InboxSearchFilterSuggestion[];
  contacts: InboxSearchContactSuggestion[];
  subjects: InboxSearchSubjectSuggestion[];
};

export type EmailIntelligenceCategory =
  | "action_needed"
  | "important"
  | "newsletter"
  | "transactional"
  | "notification";

export type EmailIntelligenceUrgency = "high" | "medium" | "low";

export type EmailAction = {
  id: string;
  type: "reply" | "archive" | "label" | "snooze" | "create_task";
  label: string;
  payload: Record<string, unknown>;
  trustLevel: "auto" | "approve";
  status: "pending" | "executed" | "dismissed" | "failed";
  error: string | null;
  executedAt: number | null;
  updatedAt: number;
};

export type CalendarSuggestion = {
  id: number;
  title: string;
  proposedDate: string;
  startAt: number;
  endAt: number;
  isAllDay: boolean;
  confidence: "high" | "low";
  sourceText: string;
  status: "pending" | "approved" | "dismissed";
  location: string | null;
  attendees: string[] | null;
  googleEventId: string | null;
  updatedAt: number;
};

export type EmailIntelligence = {
  category: EmailIntelligenceCategory;
  urgency: EmailIntelligenceUrgency;
  briefingSentence: string | null;
  actions: EmailAction[];
  calendarEvents: CalendarSuggestion[];
  autoExecute: string[];
  requiresApproval: string[];
};

export type EmailDetailIntelligence = {
  summary: string | null;
  actions: EmailAction[];
  calendarEvents: CalendarSuggestion[];
  autoExecute: string[];
  requiresApproval: string[];
};

export type EmailListItem = {
  id: string;
  mailboxId: number | null;
  providerMessageId: string;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  ccAddr: string | null;
  subject: string | null;
  snippet: string | null;
  threadId: string | null;
  date: number;
  direction: "sent" | "received" | null;
  isRead: boolean;
  labelIds: string[];
  hasAttachment: boolean;
  createdAt: number;
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  snoozedUntil: number | null;
  intelligenceStatus: "pending" | "ready" | "error" | null;
  intelligence: EmailIntelligence | null;
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
  bodyText: string | null;
  bodyHtml: string | null;
  resolvedBodyText: string | null;
  resolvedBodyHtml: string | null;
  attachments: EmailAttachment[];
};

export type EmailListResponse = {
  data: EmailListItem[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  searchMeta?: {
    hiddenJunkCount: number;
  };
};

export type ComposeInitial = {
  mailboxId?: number | null;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  bodyHtml?: string;
  threadId?: string;
};
