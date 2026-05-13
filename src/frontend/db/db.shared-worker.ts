/// <reference lib="webworker" />
import * as Comlink from "comlink";
import type {
  BatchOptions,
  BindParam,
  ExecMode,
  ExecResult,
  ExecStep,
  PerfStats,
  Priority,
  SyncNotification,
  WorkerApi,
} from "./shared/types";

type SharedWorkerScope = typeof globalThis & {
  onconnect: ((event: MessageEvent) => void) | null;
};

type RegisterTabMessage = {
  type: "register-tab";
  tabId: string;
  ownerPort: MessagePort;
};

type TabRecord = {
  id: string;
  port: MessagePort;
  ownerApi: Comlink.Remote<WorkerApi>;
};

type ListenerRecord = {
  callback: (notification: SyncNotification) => void;
};

const DB_REQUEST_TIMEOUT_MS = 60_000;

const tabs = new Map<string, TabRecord>();
const listeners = new Map<number, ListenerRecord>();
let activeTabId: string | null = null;
let nextListenerToken = 1;
let activeNotificationToken: number | null = null;

function isRegisterTabMessage(value: unknown): value is RegisterTabMessage {
  if (typeof value !== "object" || value === null) return false;
  const msg = value as Partial<RegisterTabMessage>;
  return (
    msg.type === "register-tab" &&
    typeof msg.tabId === "string" &&
    msg.ownerPort instanceof MessagePort
  );
}

function isReadSql(sql: string): boolean {
  const s = sql.trimStart().toUpperCase();
  return s.startsWith("SELECT") || s.startsWith("PRAGMA");
}

function deactivate(tabId: string): void {
  const tab = tabs.get(tabId);
  if (tab) {
    try {
      tab.ownerApi[Comlink.releaseProxy]();
    } catch {}
  }
  tabs.delete(tabId);
  if (activeTabId === tabId) {
    activeTabId = null;
    activeNotificationToken = null;
  }
}

function electActive(preferredTabId?: string): TabRecord {
  if (!activeTabId || !tabs.has(activeTabId)) {
    activeTabId =
      preferredTabId && tabs.has(preferredTabId)
        ? preferredTabId
        : (tabs.keys().next().value ?? null);
  }

  const active = activeTabId ? tabs.get(activeTabId) : null;
  if (!active) throw new Error("No active database tab available");
  return active;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Database owner timed out")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function fanOutNotification(
  notification: SyncNotification,
): Promise<void> {
  for (const listener of listeners.values()) {
    try {
      listener.callback(notification);
    } catch (err) {
      console.error("[db.shared.notify] listener threw", err);
    }
  }
}

async function ensureNotificationSubscription(): Promise<void> {
  if (listeners.size === 0 || activeNotificationToken != null) return;
  const active = electActive();
  activeNotificationToken = await active.ownerApi.subscribeSyncNotifications(
    Comlink.proxy((notification) => {
      void fanOutNotification(notification);
    }),
  );
}

async function resetNotificationSubscription(): Promise<void> {
  const active = activeTabId ? tabs.get(activeTabId) : null;
  if (active && activeNotificationToken != null) {
    try {
      await active.ownerApi.unsubscribeSyncNotifications(activeNotificationToken);
    } catch {}
  }
  activeNotificationToken = null;
  await ensureNotificationSubscription();
}

async function callActive<T>(
  requesterTabId: string,
  fn: (api: Comlink.Remote<WorkerApi>) => Promise<T>,
  options?: { retryRead?: boolean },
): Promise<T> {
  let active = electActive(requesterTabId);
  try {
    return await withTimeout(fn(active.ownerApi), DB_REQUEST_TIMEOUT_MS);
  } catch (err) {
    if (!options?.retryRead || active.id !== activeTabId) throw err;
    deactivate(active.id);
    active = electActive();
    await resetNotificationSubscription();
    return withTimeout(fn(active.ownerApi), DB_REQUEST_TIMEOUT_MS);
  }
}

function createTabApi(tabId: string): WorkerApi {
  return {
    async init(): Promise<void> {
      await callActive(tabId, (api) => api.init());
      await ensureNotificationSubscription();
    },

    async deleteDb(): Promise<void> {
      await callActive(tabId, (api) => api.deleteDb());
    },

    async exec(
      sql: string,
      params: BindParam[],
      mode: ExecMode,
      priority: Priority = 1,
    ): Promise<ExecResult> {
      return callActive(
        tabId,
        (api) => api.exec(sql, params, mode, priority),
        { retryRead: isReadSql(sql) },
      );
    },

    async batch(
      steps: ExecStep[],
      options?: BatchOptions,
    ): Promise<ExecResult[]> {
      return callActive(tabId, (api) => api.batch(steps, options));
    },

    async subscribeSyncNotifications(
      callback: (notification: SyncNotification) => void,
    ): Promise<number> {
      const token = nextListenerToken++;
      listeners.set(token, { callback });
      await ensureNotificationSubscription();
      return token;
    },

    async unsubscribeSyncNotifications(token: number): Promise<void> {
      listeners.delete(token);
      if (listeners.size > 0 || activeNotificationToken == null) return;
      const active = activeTabId ? tabs.get(activeTabId) : null;
      if (active) {
        try {
          await active.ownerApi.unsubscribeSyncNotifications(
            activeNotificationToken,
          );
        } catch {}
      }
      activeNotificationToken = null;
    },

    async getPerfStats(): Promise<Record<string, PerfStats>> {
      return callActive(tabId, (api) => api.getPerfStats(), {
        retryRead: true,
      });
    },

    async clearPerfStats(): Promise<void> {
      await callActive(tabId, (api) => api.clearPerfStats(), {
        retryRead: true,
      });
    },
  };
}

const sharedScope = globalThis as SharedWorkerScope;

sharedScope.onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  if (!port) return;

  const register = (messageEvent: MessageEvent) => {
    const message = messageEvent.data;
    if (!isRegisterTabMessage(message)) return;

    port.removeEventListener("message", register);
    const ownerApi = Comlink.wrap<WorkerApi>(message.ownerPort);
    tabs.set(message.tabId, { id: message.tabId, port, ownerApi });
    if (!activeTabId) activeTabId = message.tabId;

    Comlink.expose(createTabApi(message.tabId), port);
  };

  port.addEventListener("message", register);
  port.start();
};
