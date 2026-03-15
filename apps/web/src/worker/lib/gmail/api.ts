import type {
  GmailErrorResponse,
  GmailMessageFormat,
  GmailListResponse,
  GmailHistoryResponse,
  GmailProfileResponse,
  GmailMessage,
} from "./types";
import { GmailHistoryExpiredError } from "./errors";

export const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
export const GMAIL_PAGE_SIZE = 500;
export const MESSAGE_CHUNK_SIZE = 50;
export const FETCH_CONCURRENCY = 3;
export const CHUNK_DELAY_MS = 1_000;

const GMAIL_MAX_RATE_LIMIT_RETRIES = 5;
const GMAIL_RETRY_BASE_DELAY_MS = 1_000;
const GMAIL_RETRY_MAX_DELAY_MS = 30_000;
const GMAIL_RATE_LIMIT_REASONS = new Set([
  "ratelimitexceeded",
  "userratelimitexceeded",
  "quotaexceeded",
  "dailylimitexceeded",
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(retryAfter: string | null): number | null {
  if (!retryAfter) {
    return null;
  }

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
  if (response.status === 429) {
    return true;
  }

  if (response.status !== 403) {
    return false;
  }

  const payload = (await response
    .clone()
    .json()
    .catch(() => null)) as GmailErrorResponse | null;
  if (!payload?.error) {
    return false;
  }

  if (payload.error.status?.toLowerCase() === "resource_exhausted") {
    return true;
  }

  for (const entry of payload.error.errors ?? []) {
    const reason = entry.reason?.toLowerCase();
    if (reason && GMAIL_RATE_LIMIT_REASONS.has(reason)) {
      return true;
    }
  }

  const errorMessage = payload.error.message?.toLowerCase() ?? "";
  return errorMessage.includes("rate limit") || errorMessage.includes("quota");
}

export async function gmailRequestRaw(
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
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      if (attempt === GMAIL_MAX_RATE_LIMIT_RETRIES) {
        throw error;
      }

      const delayMs = computeRetryDelayMs(attempt);
      console.warn("Gmail API network error. Retrying request.", {
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
    if (!isRateLimited || attempt === GMAIL_MAX_RATE_LIMIT_RETRIES) {
      return response;
    }

    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
    const delayMs = retryAfterMs ?? computeRetryDelayMs(attempt);

    console.warn("Gmail API rate-limited. Retrying request.", {
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
    throw new GmailHistoryExpiredError(
      "Gmail history is too old. Run a full sync again.",
    );
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

export async function fetchMessageBatch(
  accessToken: string,
  messageId: string,
): Promise<GmailMessage> {
  return fetchMessage(accessToken, messageId, "full");
}

export async function fetchMinimalMessage(
  accessToken: string,
  messageId: string,
): Promise<GmailMessage> {
  return fetchMessage(accessToken, messageId, "minimal");
}

export { sleep };
