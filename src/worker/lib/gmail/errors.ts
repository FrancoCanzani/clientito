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

export type SyncJobErrorClass =
  | "reconnect_required"
  | "history_expired"
  | "state_error"
  | "stale_lock"
  | "sync_failed";

export function classifySyncError(error: unknown): SyncJobErrorClass {
  if (isGmailReconnectRequiredError(error)) return "reconnect_required";

  if (
    error instanceof Error &&
    error.message.toLowerCase().includes("full sync again")
  ) {
    return "history_expired";
  }

  if (error instanceof GmailSyncStateError) return "state_error";

  return "sync_failed";
}
