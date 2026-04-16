export const GOOGLE_RECONNECT_REQUIRED_MESSAGE =
  "Google connection expired. Please sign out and sign in with Google again.";

const GMAIL_HISTORY_EXPIRED_ERROR = "GmailHistoryExpiredError";
const GMAIL_RATE_LIMIT_ERROR = "GmailRateLimitError";

function taggedError(message: string, name: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

export function createGmailHistoryExpiredError(message: string): Error {
  return taggedError(message, GMAIL_HISTORY_EXPIRED_ERROR);
}

export function createGmailRateLimitError(message: string): Error {
  return taggedError(message, GMAIL_RATE_LIMIT_ERROR);
}

export function isGmailHistoryExpiredError(error: unknown): boolean {
  return error instanceof Error && error.name === GMAIL_HISTORY_EXPIRED_ERROR;
}

export function isGmailRateLimitError(error: unknown): boolean {
  return error instanceof Error && error.name === GMAIL_RATE_LIMIT_ERROR;
}

export function isGmailReconnectRequiredError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message === GOOGLE_RECONNECT_REQUIRED_MESSAGE;
}
