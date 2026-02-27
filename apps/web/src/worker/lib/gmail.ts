import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { account } from "../db/auth-schema";
import type { Database } from "../db/client";
import { emails, syncState } from "../db/schema";
import { upsertContact } from "./contacts";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_REFRESH_BUFFER_MS = 60_000;
const GMAIL_PAGE_SIZE = 500;
const MESSAGE_CHUNK_SIZE = 50;
const FETCH_CONCURRENCY = 3;
const CHUNK_DELAY_MS = 1_000;
const GMAIL_MAX_RATE_LIMIT_RETRIES = 5;
const GMAIL_RETRY_BASE_DELAY_MS = 1_000;
const GMAIL_RETRY_MAX_DELAY_MS = 30_000;
const GMAIL_RATE_LIMIT_REASONS = new Set([
  "ratelimitexceeded",
  "userratelimitexceeded",
  "quotaexceeded",
  "dailylimitexceeded",
]);
const SYNC_LOCK_TTL_MS = 4 * 60_000;
const GOOGLE_RECONNECT_REQUIRED_MESSAGE =
  "Google connection expired. Please sign out and sign in with Google again.";

type GoogleOAuthConfig = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GmailListResponse = {
  messages?: Array<{ id: string; threadId?: string }>;
  nextPageToken?: string;
};

type GmailMessagePart = {
  mimeType?: string;
  body?: {
    data?: string;
  };
  parts?: GmailMessagePart[];
  headers?: Array<{ name?: string; value?: string }>;
};

type GmailMessage = {
  id: string;
  threadId?: string;
  historyId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailMessagePart;
};

type GmailHistoryResponse = {
  history?: Array<{
    id?: string;
    messagesAdded?: Array<{
      message?: { id?: string };
    }>;
  }>;
  nextPageToken?: string;
  historyId?: string;
};

type GmailProfileResponse = {
  historyId?: string;
};

type GmailErrorResponse = {
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

export type SyncProgressFn = (
  phase: string,
  current: number,
  total: number,
) => Promise<void>;

export class GmailSyncStateError extends Error {}

export class GmailHistoryExpiredError extends Error {}

export function isGmailReconnectRequiredError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message === GOOGLE_RECONNECT_REQUIRED_MESSAGE;
}

function toEpochMs(
  value: Date | number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number") {
    return value;
  }

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
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
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

export async function getGmailToken(
  db: Database,
  userId: string,
  config?: GoogleOAuthConfig,
): Promise<string> {
  const googleAccount = await db.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, "google")),
  });

  if (!googleAccount) {
    throw new Error("Google account is not connected.");
  }

  const expiresAt = toEpochMs(googleAccount.accessTokenExpiresAt);
  const now = Date.now();
  const hasValidAccessToken =
    Boolean(googleAccount.accessToken) &&
    (expiresAt === null || expiresAt - TOKEN_REFRESH_BUFFER_MS > now);

  if (hasValidAccessToken) {
    return googleAccount.accessToken!;
  }

  if (!googleAccount.refreshToken) {
    throw new Error(GOOGLE_RECONNECT_REQUIRED_MESSAGE);
  }

  const refreshed = await refreshGoogleAccessToken(
    googleAccount.refreshToken,
    config,
  );
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

function maxHistoryId(
  current: string | null,
  candidate?: string | null,
): string | null {
  if (!candidate) {
    return current;
  }
  if (!current) {
    return candidate;
  }

  try {
    return BigInt(candidate) > BigInt(current) ? candidate : current;
  } catch {
    return candidate;
  }
}

function chunkArray<T>(list: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < list.length; index += size) {
    chunks.push(list.slice(index, index + size));
  }

  return chunks;
}

async function runConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function extractBodyByMimeType(
  part: GmailMessagePart | undefined,
  mimeType: string,
): string | null {
  if (!part) {
    return null;
  }

  if (part.mimeType?.toLowerCase().startsWith(mimeType) && part.body?.data) {
    try {
      return decodeBase64Url(part.body.data);
    } catch {
      return null;
    }
  }

  for (const child of part.parts ?? []) {
    const found = extractBodyByMimeType(child, mimeType);
    if (found) {
      return found;
    }
  }

  return null;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMessageBodyText(message: GmailMessage): string | null {
  const plain = extractBodyByMimeType(message.payload, "text/plain");
  if (plain && plain.trim().length > 0) {
    return plain.trim();
  }

  const html = extractBodyByMimeType(message.payload, "text/html");
  if (html && html.trim().length > 0) {
    const converted = htmlToPlainText(html);
    return converted.length > 0 ? converted : null;
  }

  return null;
}

function getHeaderValue(
  headers: Array<{ name?: string; value?: string }> | undefined,
  headerName: string,
): string | null {
  if (!headers || headers.length === 0) {
    return null;
  }

  const header = headers.find(
    (entry) => entry.name?.toLowerCase() === headerName.toLowerCase(),
  );

  return header?.value?.trim() ?? null;
}

function extractAddress(headerValue: string | null): string {
  if (!headerValue) {
    return "";
  }

  const match = headerValue.match(/<([^>]+)>/);
  return (match?.[1] ?? headerValue).trim();
}

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
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

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

async function gmailRequest<T>(
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

async function getCurrentHistoryId(
  accessToken: string,
): Promise<string | null> {
  const profile = await gmailRequest<GmailProfileResponse>(
    accessToken,
    "/profile",
  );
  return profile.historyId ?? null;
}

async function getMessage(
  accessToken: string,
  messageId: string,
): Promise<GmailMessage> {
  return gmailRequest<GmailMessage>(accessToken, `/messages/${messageId}`, {
    format: "full",
    fields:
      "id,threadId,historyId,internalDate,snippet,payload(mimeType,headers,body/data,parts(mimeType,headers,body/data,parts))",
  });
}

async function listMessagesPage(
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

async function listHistoryPage(
  accessToken: string,
  startHistoryId: string,
  pageToken?: string,
): Promise<GmailHistoryResponse> {
  const response = await gmailRequestRaw(accessToken, "/history", {
    startHistoryId,
    historyTypes: "messageAdded",
    maxResults: String(GMAIL_PAGE_SIZE),
    pageToken,
    fields:
      "history/id,history/messagesAdded/message/id,nextPageToken,historyId",
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

type ProcessMessagesInput = {
  db: Database;
  accessToken: string;
  orgId: string;
  messageIds: string[];
  onProgress?: SyncProgressFn;
  progressOffset?: number;
  progressTotal?: number;
};

async function processMessageIds({
  db,
  accessToken,
  orgId,
  messageIds,
  onProgress,
  progressOffset = 0,
  progressTotal,
}: ProcessMessagesInput): Promise<GmailSyncResult> {
  const result: GmailSyncResult = {
    processed: 0,
    inserted: 0,
    skipped: 0,
    historyId: null,
  };

  const total = progressTotal ?? messageIds.length;

  for (const chunk of chunkArray(messageIds, MESSAGE_CHUNK_SIZE)) {
    if (chunk.length === 0) {
      continue;
    }

    const existingRows = await db
      .select({ gmailId: emails.gmailId })
      .from(emails)
      .where(inArray(emails.gmailId, chunk));

    const existingIds = new Set(existingRows.map((row) => row.gmailId));
    const newIds = chunk.filter((id) => !existingIds.has(id));
    result.skipped += chunk.length - newIds.length;
    result.processed += chunk.length - newIds.length;

    const messages = await runConcurrent(
      newIds,
      FETCH_CONCURRENCY,
      async (messageId) => {
        try {
          return await getMessage(accessToken, messageId);
        } catch (error) {
          console.error("Failed to fetch Gmail message", { messageId, error });
          return null;
        }
      },
    );

    for (const message of messages) {
      result.processed += 1;

      if (!message) {
        result.skipped += 1;
        continue;
      }

      try {
        const rawFrom = getHeaderValue(message.payload?.headers, "From");
        const rawTo = getHeaderValue(message.payload?.headers, "To");
        const fromAddr = extractAddress(rawFrom);
        const toAddr = extractAddress(rawTo);
        const subject = getHeaderValue(message.payload?.headers, "Subject");
        const bodyText = extractMessageBodyText(message);
        const internalDate = Number(message.internalDate ?? "");
        const date =
          Number.isFinite(internalDate) && internalDate > 0
            ? internalDate
            : Date.now();

        const inserted = await db
          .insert(emails)
          .values({
            orgId,
            gmailId: message.id,
            threadId: message.threadId ?? null,
            customerId: null,
            fromAddr,
            toAddr: toAddr || null,
            subject,
            snippet: message.snippet ?? null,
            bodyText: bodyText || null,
            date,
            isCustomer: false,
            classified: false,
            createdAt: Date.now(),
          })
          .onConflictDoNothing({ target: emails.gmailId })
          .returning({ id: emails.id });

        if (inserted.length > 0) {
          result.inserted += 1;
          // Upsert contacts for sender and recipient
          if (rawFrom) {
            await upsertContact(db, orgId, rawFrom, date).catch(() => {});
          }
          if (rawTo) {
            await upsertContact(db, orgId, rawTo, date).catch(() => {});
          }
        } else {
          result.skipped += 1;
        }

        result.historyId = maxHistoryId(result.historyId, message.historyId);
      } catch (error) {
        result.skipped += 1;
        console.error("Failed to store Gmail message", {
          messageId: message.id,
          error,
        });
      }
    }

    if (onProgress) {
      await onProgress("fetching", progressOffset + result.processed, total);
    }

    if (result.processed < total) {
      await sleep(CHUNK_DELAY_MS);
    }
  }

  return result;
}

type PersistSyncStateInput = {
  db: Database;
  orgId: string;
  userId: string;
  historyId: string | null;
};

async function persistSyncState({
  db,
  orgId,
  userId,
  historyId,
}: PersistSyncStateInput) {
  const now = Date.now();
  const existing = await db.query.syncState.findFirst({
    where: eq(syncState.orgId, orgId),
  });

  if (existing) {
    await db
      .update(syncState)
      .set({
        userId,
        historyId,
        lastSync: now,
      })
      .where(eq(syncState.orgId, orgId));
    return;
  }

  await db.insert(syncState).values({
    orgId,
    userId,
    historyId,
    lastSync: now,
  });
}

async function acquireSyncLock(
  db: Database,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const now = Date.now();
  const lockUntil = now + SYNC_LOCK_TTL_MS;

  await db
    .insert(syncState)
    .values({
      orgId,
      userId,
      historyId: null,
      lastSync: null,
      lockUntil: null,
    })
    .onConflictDoNothing({ target: syncState.orgId });

  const locked = await db
    .update(syncState)
    .set({
      userId,
      lockUntil,
    })
    .where(
      and(
        eq(syncState.orgId, orgId),
        or(isNull(syncState.lockUntil), lt(syncState.lockUntil, now)),
      ),
    )
    .returning({ id: syncState.id });

  return locked.length > 0;
}

async function releaseSyncLock(db: Database, orgId: string): Promise<void> {
  await db
    .update(syncState)
    .set({
      lockUntil: null,
    })
    .where(eq(syncState.orgId, orgId));
}

export async function startFullGmailSync(
  db: Database,
  env: Env,
  orgId: string,
  userId: string,
  onProgress?: SyncProgressFn,
  gmailQuery?: string,
): Promise<GmailSyncResult> {
  const hasLock = await acquireSyncLock(db, orgId, userId);
  if (!hasLock) {
    throw new GmailSyncStateError(
      "Sync already in progress for this organization.",
    );
  }

  try {
    const accessToken = await getGmailToken(db, userId, {
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    });

    // Phase 1: collect all message IDs
    await onProgress?.("listing", 0, 0);
    const allMessageIds: string[] = [];
    let pageToken: string | undefined;

    do {
      const page = await listMessagesPage(accessToken, pageToken, gmailQuery);
      const ids = (page.messages ?? []).map((m) => m.id);
      allMessageIds.push(...ids);
      await onProgress?.("listing", allMessageIds.length, 0);
      pageToken = page.nextPageToken;
    } while (pageToken);

    // Phase 2: fetch each message
    await onProgress?.("fetching", 0, allMessageIds.length);
    const result = await processMessageIds({
      db,
      accessToken,
      orgId,
      messageIds: allMessageIds,
      onProgress,
      progressOffset: 0,
      progressTotal: allMessageIds.length,
    });

    const latestHistoryId = maxHistoryId(
      result.historyId,
      await getCurrentHistoryId(accessToken),
    );
    result.historyId = latestHistoryId;

    await persistSyncState({ db, orgId, userId, historyId: latestHistoryId });
    return result;
  } finally {
    await releaseSyncLock(db, orgId);
  }
}

function extractMessageIdsFromHistory(
  history: GmailHistoryResponse["history"],
): string[] {
  const ids: string[] = [];

  for (const entry of history ?? []) {
    for (const added of entry.messagesAdded ?? []) {
      const messageId = added.message?.id;
      if (messageId) {
        ids.push(messageId);
      }
    }
  }

  return ids;
}

export async function runIncrementalGmailSync(
  db: Database,
  env: Env,
  orgId: string,
  userId: string,
  startHistoryIdInput?: string | null,
): Promise<GmailSyncResult> {
  const hasLock = await acquireSyncLock(db, orgId, userId);
  if (!hasLock) {
    throw new GmailSyncStateError(
      "Sync already in progress for this organization.",
    );
  }

  try {
    const state = await db.query.syncState.findFirst({
      where: eq(syncState.orgId, orgId),
    });
    const startHistoryId = startHistoryIdInput ?? state?.historyId ?? null;
    if (!startHistoryId) {
      throw new GmailSyncStateError(
        "No sync state found. Run full sync first.",
      );
    }

    const accessToken = await getGmailToken(db, userId, {
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    });

    let pageToken: string | undefined;
    let latestHistoryId: string | null = startHistoryId;
    const seenMessageIds = new Set<string>();
    const aggregate: GmailSyncResult = {
      processed: 0,
      inserted: 0,
      skipped: 0,
      historyId: null,
    };

    do {
      const page = await listHistoryPage(
        accessToken,
        startHistoryId,
        pageToken,
      );
      latestHistoryId = maxHistoryId(latestHistoryId, page.historyId);

      for (const entry of page.history ?? []) {
        latestHistoryId = maxHistoryId(latestHistoryId, entry.id);
      }

      const pageMessageIds = extractMessageIdsFromHistory(page.history).filter(
        (id) => {
          if (seenMessageIds.has(id)) {
            return false;
          }
          seenMessageIds.add(id);
          return true;
        },
      );

      const pageResult = await processMessageIds({
        db,
        accessToken,
        orgId,
        messageIds: pageMessageIds,
      });

      aggregate.processed += pageResult.processed;
      aggregate.inserted += pageResult.inserted;
      aggregate.skipped += pageResult.skipped;
      latestHistoryId = maxHistoryId(latestHistoryId, pageResult.historyId);
      pageToken = page.nextPageToken;
    } while (pageToken);

    if (!latestHistoryId) {
      latestHistoryId = await getCurrentHistoryId(accessToken);
    }

    aggregate.historyId = latestHistoryId;
    await persistSyncState({
      db,
      orgId,
      userId,
      historyId: latestHistoryId,
    });

    return aggregate;
  } finally {
    await releaseSyncLock(db, orgId);
  }
}

export async function runScheduledIncrementalSync(
  db: Database,
  env: Env,
): Promise<void> {
  const states = await db
    .select({
      orgId: syncState.orgId,
      userId: syncState.userId,
      historyId: syncState.historyId,
    })
    .from(syncState);

  for (const state of states) {
    if (!state.historyId) {
      continue;
    }

    try {
      await runIncrementalGmailSync(
        db,
        env,
        String(state.orgId),
        state.userId,
        state.historyId,
      );
    } catch (error) {
      if (isGmailReconnectRequiredError(error)) {
        console.warn("Scheduled Gmail sync requires Google reconnect", {
          orgId: state.orgId,
          userId: state.userId,
        });
      } else {
        console.error("Scheduled Gmail incremental sync failed", {
          orgId: state.orgId,
          userId: state.userId,
          error,
        });
      }
    }
  }
}
