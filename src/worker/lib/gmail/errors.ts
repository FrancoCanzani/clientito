import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { mailboxes } from "../../db/schema";
import type { AppRouteEnv } from "../../routes/types";

export const GOOGLE_RECONNECT_REQUIRED_MESSAGE =
  "Google connection expired. Please sign out and sign in with Google again.";

const GMAIL_RATE_LIMIT_ERROR = "GmailRateLimitError";

function taggedError(message: string, name: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

export function createGmailRateLimitError(message: string): Error {
  return taggedError(message, GMAIL_RATE_LIMIT_ERROR);
}

export function isGmailRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === GMAIL_RATE_LIMIT_ERROR;
}

export function isGmailReconnectRequiredError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message === GOOGLE_RECONNECT_REQUIRED_MESSAGE;
}

export function handleGmailError(
  error: unknown,
  db: AppRouteEnv["Variables"]["db"],
  mailboxId: number,
  c: Context<AppRouteEnv>,
): Response | null {
  if (isGmailReconnectRequiredError(error)) {
    void db
      .update(mailboxes)
      .set({
        authState: "reconnect_required",
        lastErrorAt: Date.now(),
        lastErrorMessage: GOOGLE_RECONNECT_REQUIRED_MESSAGE,
        updatedAt: Date.now(),
      })
      .where(eq(mailboxes.id, mailboxId));
    return c.json(
      {
        error: "google_reconnect_required",
        message: GOOGLE_RECONNECT_REQUIRED_MESSAGE,
      },
      401,
    );
  }
  if (isGmailRateLimitError(error)) {
    c.header("Retry-After", "60");
    return c.json({ error: "gmail_rate_limited" }, 429);
  }
  return null;
}
