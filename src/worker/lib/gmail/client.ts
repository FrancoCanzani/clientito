import { eq } from "drizzle-orm";
import { account } from "../../db/auth-schema";
import type { Database } from "../../db/client";
import { mailboxes } from "../../db/schema";
import { sleep } from "../utils";
import {
  createGmailHistoryExpiredError,
  createGmailRateLimitError,
  GOOGLE_RECONNECT_REQUIRED_MESSAGE,
  isGmailReconnectRequiredError,
} from "./errors";
import type {
  GmailErrorResponse,
  GmailHistoryResponse,
  GmailListResponse,
  GmailMessage,
  GmailMessageFormat,
  GmailProfileResponse,
  GoogleOAuthConfig,
  GoogleTokenResponse,
} from "./types";

export const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const GMAIL_PAGE_SIZE = 500;
export const MESSAGE_CHUNK_SIZE = 50;

const GMAIL_MAX_RATE_LIMIT_RETRIES = 5;
const GMAIL_RETRY_BASE_DELAY_MS = 1_000;
const GMAIL_RETRY_MAX_DELAY_MS = 30_000;
const GMAIL_RATE_LIMIT_REASONS = new Set([
  "ratelimitexceeded",
  "userratelimitexceeded",
  "quotaexceeded",
  "dailylimitexceeded",
]);

const TOKEN_REFRESH_BUFFER_MS = 60_000;
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function parseRetryAfterMs(retryAfter: string | null): number | null {
  if (!retryAfter) return null;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.floor(seconds * 1000);
  }

  const timestamp = Date.parse(retryAfter);
  if (!Number.isNaN(timestamp)) {
    return Math.max(0, timestamp - Date.now());
  }

  return null;
}

function computeRetryDelayMs(attempt: number): number {
  const exponentialDelay = Math.min(
    GMAIL_RETRY_MAX_DELAY_MS,
    GMAIL_RETRY_BASE_DELAY_MS * 2 ** attempt,
  );
  const jitter = Math.floor(Math.random() * GMAIL_RETRY_BASE_DELAY_MS);
  return Math.min(GMAIL_RETRY_MAX_DELAY_MS, exponentialDelay + jitter);
}

async function isRateLimitedResponse(response: Response): Promise<boolean> {
  if (response.status === 429) return true;
  if (response.status !== 403) return false;

  const payload = (await response
    .clone()
    .json()
    .catch(() => null)) as GmailErrorResponse | null;
  if (!payload?.error) return false;

  if (payload.error.status?.toLowerCase() === "resource_exhausted") return true;

  for (const entry of payload.error.errors ?? []) {
    const reason = entry.reason?.toLowerCase();
    if (reason && GMAIL_RATE_LIMIT_REASONS.has(reason)) return true;
  }

  const errorMessage = payload.error.message?.toLowerCase() ?? "";
  return errorMessage.includes("rate limit") || errorMessage.includes("quota");
}

async function gmailRequestRaw(
  accessToken: string,
  path: string,
  query?: Record<string, string | undefined>,
): Promise<Response> {
  const url = new URL(`${GMAIL_API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  let attempt = 0;
  while (attempt <= GMAIL_MAX_RATE_LIMIT_RETRIES) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      if (attempt === GMAIL_MAX_RATE_LIMIT_RETRIES) throw error;

      const delayMs = computeRetryDelayMs(attempt);
      console.warn("Gmail API network error, retrying", {
        path,
        attempt: attempt + 1,
        delayMs,
        error: error instanceof Error ? error.message : String(error),
      });

      await sleep(delayMs);
      attempt += 1;
      continue;
    }

    const isRateLimited = await isRateLimitedResponse(response);
    if (!isRateLimited) {
      return response;
    }

    if (attempt === GMAIL_MAX_RATE_LIMIT_RETRIES) {
      throw createGmailRateLimitError(
        `Gmail API rate limit reached for ${path} (status ${response.status}).`,
      );
    }

    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
    const delayMs = retryAfterMs ?? computeRetryDelayMs(attempt);
    console.warn("Gmail API rate-limited, retrying", {
      path,
      attempt: attempt + 1,
      delayMs,
      status: response.status,
    });

    await sleep(delayMs);
    attempt += 1;
  }

  throw new Error("Exceeded Gmail API retry attempts.");
}

export async function gmailRequest<T>(
  accessToken: string,
  path: string,
  query?: Record<string, string | undefined>,
): Promise<T> {
  const response = await gmailRequestRaw(accessToken, path, query);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(GOOGLE_RECONNECT_REQUIRED_MESSAGE);
    }
    const body = await response.text().catch(() => "");
    throw new Error(
      `Gmail request failed (${response.status}): ${body || response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

export async function getCurrentHistoryId(
  accessToken: string,
): Promise<string | null> {
  const profile = await gmailRequest<GmailProfileResponse>(
    accessToken,
    "/profile",
  );
  return profile.historyId ?? null;
}

export async function listMessagesPage(
  accessToken: string,
  pageToken?: string,
  query?: string,
): Promise<GmailListResponse> {
  return gmailRequest<GmailListResponse>(accessToken, "/messages", {
    maxResults: String(GMAIL_PAGE_SIZE),
    includeSpamTrash: "true",
    pageToken,
    q: query,
    fields: "messages/id,nextPageToken",
  });
}

export async function listHistoryPage(
  accessToken: string,
  startHistoryId: string,
  pageToken?: string,
): Promise<GmailHistoryResponse> {
  const response = await gmailRequestRaw(accessToken, "/history", {
    startHistoryId,
    maxResults: String(GMAIL_PAGE_SIZE),
    pageToken,
    fields:
      "history/id,history/messagesAdded/message/id,history/messagesDeleted/message/id,history/labelsAdded/message/id,history/labelsAdded/labelIds,history/labelsRemoved/message/id,history/labelsRemoved/labelIds,nextPageToken,historyId",
  });

  if (response.status === 404) {
    throw createGmailHistoryExpiredError(
      "Gmail history is too old. Run a full sync again.",
    );
  }

  if (response.status === 401) {
    throw new Error(GOOGLE_RECONNECT_REQUIRED_MESSAGE);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Gmail history request failed (${response.status}): ${body || response.statusText}`,
    );
  }

  return (await response.json()) as GmailHistoryResponse;
}

export async function fetchMessage(
  accessToken: string,
  messageId: string,
  format: GmailMessageFormat,
): Promise<GmailMessage> {
  return gmailRequest<GmailMessage>(accessToken, `/messages/${messageId}`, {
    format,
    fields:
      format === "minimal"
        ? "id,threadId,historyId,internalDate,labelIds"
        : "id,threadId,historyId,internalDate,snippet,labelIds,payload(mimeType,headers,body/data,parts(mimeType,headers,body/data,parts))",
  });
}

const BATCH_BOUNDARY = "batch_petit";
const GMAIL_BATCH_URL = "https://www.googleapis.com/batch/gmail/v1";
const GMAIL_BATCH_MAX_SIZE = 100;

function buildBatchRequestBody(
  messageIds: string[],
  format: GmailMessageFormat,
): string {
  return messageIds
    .map((id) => {
      const path =
        format === "minimal"
          ? `/gmail/v1/users/me/messages/${id}?format=minimal&fields=${encodeURIComponent(
              "id,threadId,historyId,internalDate,labelIds",
            )}`
          : `/gmail/v1/users/me/messages/${id}?format=full`;
      return `--${BATCH_BOUNDARY}\r\nContent-Type: application/http\r\n\r\nGET ${path}\r\n`;
    })
    .join("\r\n") + `\r\n--${BATCH_BOUNDARY}--`;
}

function parseBatchResponse(
  responseText: string,
  boundary: string,
): Array<{ status: number; body: string }> {
  const parts = responseText.split(`--${boundary}`);
  const results: Array<{ status: number; body: string }> = [];

  for (const part of parts) {
    if (part.trim() === "" || part.trim() === "--") continue;

    const httpResponseStart = part.indexOf("HTTP/");
    if (httpResponseStart === -1) continue;

    const httpSection = part.slice(httpResponseStart);
    const statusMatch = httpSection.match(/HTTP\/[\d.]+ (\d+)/);
    const status = statusMatch ? Number(statusMatch[1]) : 0;

    const bodyStart = httpSection.indexOf("\r\n\r\n");
    const body = bodyStart !== -1 ? httpSection.slice(bodyStart + 4).trim() : "";

    results.push({ status, body });
  }

  return results;
}

export async function fetchMessagesBatch(
  accessToken: string,
  messageIds: string[],
  format: GmailMessageFormat = "full",
): Promise<Map<string, GmailMessage | null>> {
  if (messageIds.length === 0) return new Map();

  const results = new Map<string, GmailMessage | null>();

  for (let i = 0; i < messageIds.length; i += GMAIL_BATCH_MAX_SIZE) {
    const chunk = messageIds.slice(i, i + GMAIL_BATCH_MAX_SIZE);
    const body = buildBatchRequestBody(chunk, format);

    let attempt = 0;
    let response: Response | null = null;

    while (attempt <= GMAIL_MAX_RATE_LIMIT_RETRIES) {
      try {
        response = await fetch(GMAIL_BATCH_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/mixed; boundary=${BATCH_BOUNDARY}`,
          },
          body,
          signal: AbortSignal.timeout(60_000),
        });
      } catch (error) {
        if (attempt === GMAIL_MAX_RATE_LIMIT_RETRIES) throw error;
        await sleep(computeRetryDelayMs(attempt));
        attempt++;
        continue;
      }

      if (response.status === 429 || response.status === 503) {
        if (attempt === GMAIL_MAX_RATE_LIMIT_RETRIES) break;
        const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
        await sleep(retryAfterMs ?? computeRetryDelayMs(attempt));
        attempt++;
        continue;
      }

      break;
    }

    if (!response || !response.ok) {
      for (const id of chunk) {
        try {
          const msg = await fetchMessage(accessToken, id, format);
          results.set(id, msg);
        } catch {
          results.set(id, null);
        }
      }
      continue;
    }

    const responseText = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    const responseBoundary = boundaryMatch?.[1]?.replace(/^["']|["']$/g, "") ?? BATCH_BOUNDARY;

    const parsed = parseBatchResponse(responseText, responseBoundary);

    for (let j = 0; j < chunk.length && j < parsed.length; j++) {
      const part = parsed[j];
      if (part.status === 200) {
        try {
          results.set(chunk[j], JSON.parse(part.body) as GmailMessage);
        } catch {
          results.set(chunk[j], null);
        }
      } else {
        results.set(chunk[j], null);
      }
    }

    for (const id of chunk) {
      if (!results.has(id)) {
        try {
          const msg = await fetchMessage(accessToken, id, format);
          results.set(id, msg);
        } catch {
          results.set(id, null);
        }
      }
    }
  }

  return results;
}

export function hasUsableAccessToken(accountState: {
  accessToken: string | null;
  accessTokenExpiresAt: Date | number | string | null;
} | null | undefined): boolean {
  if (!accountState?.accessToken) return false;
  if (accountState.accessTokenExpiresAt === null) return true;

  const expiresAt = toEpochMs(accountState.accessTokenExpiresAt);
  if (expiresAt === null) return false;

  return expiresAt - TOKEN_REFRESH_BUFFER_MS > Date.now();
}

function toEpochMs(
  value: Date | number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function resolveGoogleCredentials(config?: GoogleOAuthConfig) {
  const clientId = config?.GOOGLE_CLIENT_ID;
  const clientSecret = config?.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are not configured.");
  }

  return { clientId, clientSecret };
}

async function refreshGoogleAccessToken(
  refreshToken: string,
  config?: GoogleOAuthConfig,
) {
  const { clientId, clientSecret } = resolveGoogleCredentials(config);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as GoogleTokenResponse;

  if (!response.ok || !payload.access_token) {
    if (payload.error === "invalid_grant") {
      throw new Error(GOOGLE_RECONNECT_REQUIRED_MESSAGE);
    }

    const message =
      payload.error_description ??
      payload.error ??
      `Google token refresh failed (${response.status}).`;
    throw new Error(message);
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in ?? 3600,
    scope: payload.scope,
  };
}

async function clearGoogleConnectionTokens(
  db: Database,
  accountId: string,
): Promise<void> {
  await db
    .update(account)
    .set({
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
    })
    .where(eq(account.id, accountId));
}

export async function getGmailToken(
  db: Database,
  accountId: string,
  config?: GoogleOAuthConfig,
): Promise<string> {
  const googleAccount = await db.query.account.findFirst({
    where: eq(account.id, accountId),
  });

  if (!googleAccount) {
    throw new Error("Google account is not connected.");
  }

  const expiresAt = toEpochMs(googleAccount.accessTokenExpiresAt);
  const hasValidAccessToken = hasUsableAccessToken({
    accessToken: googleAccount.accessToken,
    accessTokenExpiresAt: expiresAt,
  });

  if (hasValidAccessToken) {
    return googleAccount.accessToken!;
  }

  if (!googleAccount.refreshToken) {
    await clearGoogleConnectionTokens(db, accountId);
    throw new Error(GOOGLE_RECONNECT_REQUIRED_MESSAGE);
  }

  let refreshed: Awaited<ReturnType<typeof refreshGoogleAccessToken>>;
  try {
    refreshed = await refreshGoogleAccessToken(
      googleAccount.refreshToken,
      config,
    );
  } catch (error) {
    if (isGmailReconnectRequiredError(error)) {
      await clearGoogleConnectionTokens(db, accountId);
    }
    throw error;
  }

  const nextExpiresAt =
    refreshed.expiresIn > 0
      ? new Date(Date.now() + refreshed.expiresIn * 1000)
      : null;

  await db
    .update(account)
    .set({
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? googleAccount.refreshToken,
      accessTokenExpiresAt: nextExpiresAt,
      scope: refreshed.scope ?? googleAccount.scope,
    })
    .where(eq(account.id, googleAccount.id));

  return refreshed.accessToken;
}

export async function getGmailTokenForMailbox(
  db: Database,
  mailboxId: number,
  config?: GoogleOAuthConfig,
): Promise<string> {
  const mailbox = await db.query.mailboxes.findFirst({
    where: eq(mailboxes.id, mailboxId),
  });

  if (!mailbox?.accountId) {
    throw new Error("Mailbox has no linked account.");
  }

  return getGmailToken(db, mailbox.accountId, config);
}
