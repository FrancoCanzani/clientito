import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { emailQueryKeys } from "@/features/email/mail/shared/query-keys";
import { accountQueryKeys } from "@/features/settings/query-keys";
import { accountsQueryOptions } from "@/hooks/use-mailboxes";
import { deviceCapabilities } from "@/lib/device-capabilities";
import { queryClient } from "@/lib/query-client";
import { AsyncQueuer } from "@tanstack/pacer/async-queuer";
import { VIEW_PAGE_SIZE } from "@/features/email/mail/shared/data/constants";
import { alignActiveUser, persistEmails } from "@/features/email/mail/shared/data/local-cache";
import { invalidateInboxQueries, invalidateUnreadCounts } from "@/features/email/mail/shared/data/invalidation";
import { dedup } from "@/features/email/mail/shared/data/request-dedup";
import type {
  DeltaSyncResponse,
  MailListFilters,
  PulledEmail,
  RemoteCursor,
  ViewPage,
} from "@/features/email/mail/shared/data/types";
import { encodeViewCursor } from "@/features/email/mail/shared/data/view-cursor";
import {
  parseViewSyncStatus,
  setViewSyncStatus,
  viewSyncMetaKey,
  type ViewSyncStatus,
} from "@/features/email/mail/shared/data/view-sync-status";

const GMAIL_SYNC_WAIT_MS = 0;
const GMAIL_SYNC_DEFAULT_COOLDOWN_MS = 60_000;

function deltaHistoryMetaKey(mailboxId: number): string {
  return `gmailDeltaHistory:${mailboxId}`;
}

function refreshKey(mailboxId: number, view: string): string {
  return `view-refresh:${mailboxId}:${view}`;
}

const refreshInFlight = new Map<string, Promise<void>>();
const refreshLastRunAt = new Map<string, number>();
const VIEW_BACKGROUND_REFRESH_COOLDOWN_MS = 10_000;

export async function refreshViewFromServer(
  userId: string,
  mailboxId: number,
  view: string,
  reason: GmailSyncReason = "background",
): Promise<void> {
  const key = refreshKey(mailboxId, view);
  const existing = refreshInFlight.get(key);
  if (existing && reason !== "active-view") return existing;

  const lastRunAt = refreshLastRunAt.get(key) ?? 0;
  if (
    reason !== "active-view" &&
    Date.now() - lastRunAt < VIEW_BACKGROUND_REFRESH_COOLDOWN_MS
  ) {
    return;
  }

  const task = (async () => {
    try {
      await enqueueViewSyncPage({
        userId,
        mailboxId,
        view,
        remoteCursor: { type: "remote" },
        reason,
        invalidateOnSuccess: true,
      });
    } catch {
      /* background refresh failure is non-fatal */
    }
  })().finally(() => {
    refreshLastRunAt.set(key, Date.now());
    if (refreshInFlight.get(key) === task) refreshInFlight.delete(key);
  });

  refreshInFlight.set(key, task);
  return task;
}

class GmailViewFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs: number | null,
  ) {
    super(message);
    this.name = "GmailViewFetchError";
  }
}

async function fetchServerPage(
  userId: string,
  mailboxId: number,
  view: string,
  remoteCursor: RemoteCursor,
  filters?: MailListFilters,
  beforeMs?: number,
): Promise<ViewPage> {
  const res = await fetch("/api/inbox/view/page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mailboxId,
      view,
      cursor: remoteCursor.token || undefined,
      beforeMs,
      limit: VIEW_PAGE_SIZE,
      filters,
    }),
  });
  if (!res.ok) {
    const errorBody = (await res
      .clone()
      .json()
      .catch(() => null)) as { error?: string } | null;
    const retryAfter = res.headers.get("retry-after");
    const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
    const retryAfterMs =
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
        ? Math.floor(retryAfterSeconds * 1000)
        : null;
    const reconnectRequired =
      res.status === 401 && errorBody?.error === "google_reconnect_required";
    const lastError = reconnectRequired
      ? "reconnect_required"
      : res.status === 429
        ? "gmail_rate_limited"
        : `fetch_failed_${res.status}`;
    const previousMeta = parseViewSyncStatus(
      await localDb.getMeta(viewSyncMetaKey(mailboxId, view)),
    );
    await setViewSyncStatus(mailboxId, view, {
      lastFetchedAt: previousMeta.lastFetchedAt,
      lastError,
    });
    if (reconnectRequired) {
      void queryClient.invalidateQueries({
        queryKey: accountsQueryOptions.queryKey,
      });
    }
    throw new GmailViewFetchError(
      `View fetch failed: ${res.status}`,
      res.status,
      retryAfterMs,
    );
  }

  const body = (await res.json()) as {
    emails: PulledEmail[];
    cursor: string | null;
  };
  const syncStatus: ViewSyncStatus = {
    lastFetchedAt: Date.now(),
    lastError: null,
  };
  const emails = await persistEmails(body.emails, userId, mailboxId, {
    returnHydrated: true,
    meta: {
      [viewSyncMetaKey(mailboxId, view)]: JSON.stringify(syncStatus),
    },
  });
  void queryClient.invalidateQueries({
    queryKey: emailQueryKeys.viewSyncMeta(view, mailboxId),
  });
  const nextCursor = body.cursor
    ? encodeViewCursor(
        { type: "remote", token: body.cursor },
        beforeMs,
      )
    : null;
  return { emails, cursor: nextCursor };
}

type GmailSyncReason = "active-view" | "active-page" | "background";

type GmailViewSyncTask = {
  key: string;
  userId: string;
  mailboxId: number;
  view: string;
  remoteCursor: RemoteCursor;
  reason: GmailSyncReason;
  priority: number;
  invalidateOnSuccess: boolean;
  filters?: MailListFilters;
  beforeMs?: number;
  resolve: (page: ViewPage) => void;
  reject: (error: unknown) => void;
};

const gmailViewSyncInFlight = new Map<string, Promise<ViewPage>>();

function getGmailViewSyncPriority(
  view: string,
  reason: GmailSyncReason,
): number {
  if (reason === "active-page") return 1_100;
  if (reason === "active-view") return 1_000;
  if (view === "inbox") return 700;
  if (view === "sent" || view === "starred" || view === "important") return 400;
  if (view === "archived") return 250;
  if (view === "spam" || view === "trash") return 100;
  return 200;
}

function getGmailViewSyncKey(params: {
  userId: string;
  mailboxId: number;
  view: string;
  remoteCursor: RemoteCursor;
  filters?: MailListFilters;
  beforeMs?: number;
}): string {
  return [
    params.userId,
    params.mailboxId,
    params.view,
    params.remoteCursor.token ?? "first",
    params.beforeMs ?? "none",
    params.filters?.unread ? "u" : "",
    params.filters?.starred ? "s" : "",
    params.filters?.hasAttachment ? "a" : "",
  ].join(":");
}

function getGmailCooldownMs(error: unknown): number | null {
  if (!(error instanceof GmailViewFetchError)) return null;
  if (error.status !== 429 && error.status !== 503) return null;
  return error.retryAfterMs ?? GMAIL_SYNC_DEFAULT_COOLDOWN_MS;
}

const gmailViewSyncQueue = new AsyncQueuer<GmailViewSyncTask>(
  async (task) => {
    try {
      const page = await fetchServerPage(
        task.userId,
        task.mailboxId,
        task.view,
        task.remoteCursor,
        task.filters,
        task.beforeMs,
      );
      task.resolve(page);
      if (task.invalidateOnSuccess) {
        void queryClient.invalidateQueries({
          queryKey: emailQueryKeys.list(task.view, task.mailboxId),
        });
      }
    } catch (error) {
      task.reject(error);
      throw error;
    } finally {
      gmailViewSyncInFlight.delete(task.key);
    }
  },
  {
    key: "gmail-view-sync",
    concurrency: deviceCapabilities.syncConcurrency,
    wait: GMAIL_SYNC_WAIT_MS,
    maxSize: deviceCapabilities.maxSyncQueueSize,
    getPriority: (task) => task.priority,
    throwOnError: false,
    onError: (error, _task, queuer) => {
      const cooldownMs = getGmailCooldownMs(error);
      if (cooldownMs == null) return;
      queuer.stop();
      globalThis.setTimeout(() => queuer.start(), cooldownMs);
    },
  },
);

export function enqueueViewSyncPage(params: {
  userId: string;
  mailboxId: number;
  view: string;
  remoteCursor: RemoteCursor;
  reason: GmailSyncReason;
  invalidateOnSuccess?: boolean;
  filters?: MailListFilters;
  beforeMs?: number;
}): Promise<ViewPage> {
  const key = getGmailViewSyncKey(params);
  const existing = gmailViewSyncInFlight.get(key);
  if (existing) return existing;

  const promise = new Promise<ViewPage>((resolve, reject) => {
    const queued = gmailViewSyncQueue.addItem({
      ...params,
      key,
      priority: getGmailViewSyncPriority(params.view, params.reason),
      invalidateOnSuccess: params.invalidateOnSuccess ?? false,
      resolve,
      reject,
    });
    if (!queued) reject(new Error("Gmail sync queue is full."));
  });
  gmailViewSyncInFlight.set(key, promise);
  return promise;
}

export async function enqueueActiveViewSync(params: {
  mailboxId: number;
  view: string;
}): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await alignActiveUser(userId);
    await refreshViewFromServer(
      userId,
      params.mailboxId,
      params.view,
      "active-view",
    );
  } catch {
    /* Active sync is best-effort; the list can render cached local data. */
  }
}

export async function runDeltaSync(
  mailboxId: number,
): Promise<DeltaSyncResponse | null> {
  if (!mailboxId) return null;

  return dedup(`delta-sync:${mailboxId}`, async () => {
    const userId = await getCurrentUserId();
    if (!userId) return null;
    await alignActiveUser(userId);
    const localHistoryId = await localDb.getMeta(deltaHistoryMetaKey(mailboxId));

    const res = await fetch("/api/inbox/sync/delta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mailboxId,
        historyId: localHistoryId ?? undefined,
      }),
    });
    if (!res.ok) {
      if (res.status === 401) {
        await queryClient.invalidateQueries({
          queryKey: accountQueryKeys.all(),
        });
      }
      return null;
    }
    const body = (await res.json()) as DeltaSyncResponse;

    if (body.status === "stale") {
      await localDb.clearMailboxCache(userId, mailboxId);
      if (body.historyId) {
        await localDb.setMeta(deltaHistoryMetaKey(mailboxId), body.historyId);
        void ackDeltaHistory(mailboxId, body.historyId);
      }
      invalidateInboxQueries();
      invalidateUnreadCounts(mailboxId);
      await refreshViewFromServer(userId, mailboxId, "inbox", "active-view");
      return body;
    }

    let appliedAnything = false;

    if (body.added?.length) {
      await persistEmails(body.added, userId, mailboxId);
      appliedAnything = true;
    }

    if (body.deleted?.length) {
      await localDb.deleteEmailsByProviderMessageId(body.deleted, {
        userId,
        mailboxId,
      });
      appliedAnything = true;
    }

    if (body.labelChanges?.length) {
      for (const change of body.labelChanges) {
        for (const labelId of change.removedLabels) {
          await localDb.removeLabelFromEmails(
            [change.providerMessageId],
            labelId,
            mailboxId,
          );
        }
        for (const labelId of change.addedLabels) {
          await localDb.addLabelToEmails(
            [change.providerMessageId],
            labelId,
            mailboxId,
          );
        }
      }
      appliedAnything = true;
    }

    if (appliedAnything) {
      invalidateInboxQueries();
      invalidateUnreadCounts(mailboxId);
    }

    if (body.historyId) {
      await localDb.setMeta(deltaHistoryMetaKey(mailboxId), body.historyId);
      void ackDeltaHistory(mailboxId, body.historyId);
    }

    return body;
  });
}

async function ackDeltaHistory(
  mailboxId: number,
  historyId: string,
): Promise<void> {
  await fetch("/api/inbox/sync/delta/ack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mailboxId, historyId }),
  }).catch(() => {
    /* Local history is authoritative; ack only keeps account status fresh. */
  });
}
