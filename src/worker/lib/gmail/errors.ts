export const GOOGLE_RECONNECT_REQUIRED_MESSAGE =
  "Google connection expired. Please sign out and sign in with Google again.";

export class GmailSyncStateError extends Error {}

export class GmailHistoryExpiredError extends Error {}

export function isGmailReconnectRequiredError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message === GOOGLE_RECONNECT_REQUIRED_MESSAGE;
}
