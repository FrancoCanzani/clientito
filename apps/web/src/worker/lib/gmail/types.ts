export type GoogleOAuthConfig = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

export type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

export type GmailListResponse = {
  messages?: Array<{ id: string; threadId?: string }>;
  nextPageToken?: string;
};

export type GmailMessagePart = {
  partId?: string;
  filename?: string;
  mimeType?: string;
  body?: {
    data?: string;
    attachmentId?: string;
    size?: number;
  };
  parts?: GmailMessagePart[];
  headers?: Array<{ name?: string; value?: string }>;
};

export type GmailMessage = {
  id: string;
  threadId?: string;
  historyId?: string;
  internalDate?: string;
  snippet?: string;
  labelIds?: string[];
  payload?: GmailMessagePart;
};

export type GmailMessageFormat = "full" | "minimal";

export type GmailAttachmentResponse = {
  data?: string;
  size?: number;
};

export type GmailHistoryResponse = {
  history?: Array<{
    id?: string;
    messagesAdded?: Array<{
      message?: { id?: string };
    }>;
    messagesDeleted?: Array<{
      message?: { id?: string };
    }>;
    labelsAdded?: Array<{
      message?: { id?: string };
      labelIds?: string[];
    }>;
    labelsRemoved?: Array<{
      message?: { id?: string };
      labelIds?: string[];
    }>;
  }>;
  nextPageToken?: string;
  historyId?: string;
};

export type GmailProfileResponse = {
  historyId?: string;
};

export type GoogleUserInfoResponse = {
  name?: string;
  picture?: string;
};

export type GooglePersonFieldMetadata = {
  primary?: boolean;
};

export type GoogleContactName = {
  displayName?: string;
  metadata?: GooglePersonFieldMetadata;
};

export type GoogleContactEmailAddress = {
  value?: string;
  metadata?: GooglePersonFieldMetadata;
};

export type GoogleContactPhoneNumber = {
  value?: string;
  metadata?: GooglePersonFieldMetadata;
};

export type GoogleContactPhoto = {
  url?: string;
  default?: boolean;
  metadata?: GooglePersonFieldMetadata;
};

export type GoogleContactOrganization = {
  title?: string;
  name?: string;
  metadata?: GooglePersonFieldMetadata;
};

export type GoogleContactPerson = {
  names?: GoogleContactName[];
  emailAddresses?: GoogleContactEmailAddress[];
  phoneNumbers?: GoogleContactPhoneNumber[];
  photos?: GoogleContactPhoto[];
  organizations?: GoogleContactOrganization[];
};

export type GoogleConnectionsListResponse = {
  connections?: GoogleContactPerson[];
  nextPageToken?: string;
};

export type GmailErrorResponse = {
  error?: {
    status?: string;
    message?: string;
    errors?: Array<{
      reason?: string;
      message?: string;
    }>;
  };
};

export type GmailSyncResult = {
  processed: number;
  inserted: number;
  skipped: number;
  historyId: string | null;
};

export type GmailAttachmentMeta = {
  attachmentId: string;
  filename: string | null;
  mimeType: string | null;
  size: number | null;
  contentId: string | null;
  isInline: boolean;
  isImage: boolean;
};

export type SyncProgressFn = (
  phase: string,
  current: number,
  total: number,
) => Promise<void>;
