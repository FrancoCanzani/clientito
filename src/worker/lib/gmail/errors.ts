export const GOOGLE_RECONNECT_REQUIRED_MESSAGE =
  "Google connection expired. Please sign out and sign in with Google again.";

const GMAIL_SYNC_STATE_ERROR = "GmailSyncStateError";
const GMAIL_HISTORY_EXPIRED_ERROR = "GmailHistoryExpiredError";
const GMAIL_RATE_LIMIT_ERROR = "GmailRateLimitError";

function taggedError(message: string, name: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

export function createGmailSyncStateError(message: string): Error {
  return taggedError(message, GMAIL_SYNC_STATE_ERROR);
}

export function createGmailHistoryExpiredError(message: string): Error {
  return taggedError(message, GMAIL_HISTORY_EXPIRED_ERROR);
}

export function createGmailRateLimitError(message: string): Error {
  return taggedError(message, GMAIL_RATE_LIMIT_ERROR);
}

export function isGmailSyncStateError(error: unknown): boolean {
  return error instanceof Error && error.name === GMAIL_SYNC_STATE_ERROR;
}

export function isGmailHistoryExpiredError(error: unknown): boolean {
  return error instanceof Error && error.name === GMAIL_HISTORY_EXPIRED_ERROR;
}

export function isGmailRateLimitError(error: unknown): boolean {
  return error instanceof Error && error.name === GMAIL_RATE_LIMIT_ERROR;
}

export function isGmailReconnectRequiredError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message === GOOGLE_RECONNECT_REQUIRED_MESSAGE;
}

export type SyncJobErrorClass =
  | "reconnect_required"
  | "history_expired"
  | "rate_limited"
  | "state_error"
  | "stale_lock"
  | "sync_failed";

export function classifySyncError(error: unknown): SyncJobErrorClass {
  if (isGmailReconnectRequiredError(error)) return "reconnect_required";

  if (isGmailHistoryExpiredError(error)) {
    return "history_expired";
  }

  if (error instanceof Error && error.message.toLowerCase().includes("full sync again")) {
    return "history_expired";
  }

  if (isGmailRateLimitError(error)) return "rate_limited";

  if (isGmailSyncStateError(error)) return "state_error";

  return "sync_failed";
}
