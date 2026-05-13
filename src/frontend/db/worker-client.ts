import * as Comlink from "comlink";
import sharedWorkerUrl from "./db.shared-worker.ts?worker&url";
import {
  clearStats as clearTabStats,
  getStats as getTabStats,
  recordSample,
} from "./shared/perf";
import type {
  BindParam,
  ExecMode,
  ExecResult,
  ExecStep,
  PerfStats,
  Priority,
  SyncNotification,
  WorkerApi,
} from "./shared/types";

type SyncListener = (notification: SyncNotification) => void;

function inferPriority(sql: string): Priority {
  const s = sql.trimStart().toUpperCase();
  // Writes default to P1 so they never preempt user-visible reads.
  if (!s.startsWith("SELECT") && !s.startsWith("PRAGMA")) return 1;
  // Tiny metadata/count reads and the user-interactive read paths jump to P0.
  if (
    s.includes("_META") ||
    s.includes("LIMIT 1") ||
    s.includes("COUNT(") ||
    s.includes("EMAIL_BODIES") ||
    s.includes("PROVIDER_MESSAGE_ID")
  ) {
    return 0;
  }
  return 1;
}

function profileLabel(sql: string): string {
  const s = sql.trimStart();
  const word = s.slice(0, s.indexOf(" ")).toUpperCase();
  const table =
    /FROM\s+(\w+)/i.exec(s)?.[1] ??
    /INTO\s+(\w+)/i.exec(s)?.[1] ??
    /UPDATE\s+(\w+)/i.exec(s)?.[1] ??
    "";
  return `db.${word}.${table}${s.includes("LIMIT 1") ? ":1" : ""}`;
}

const DEDICATED_WORKER_URL = new URL(
  "./db.dedicated-worker.ts",
  import.meta.url,
);

type Connection = {
  terminate: () => void;
  api: Comlink.Remote<WorkerApi>;
};

type OwnerApi = WorkerApi & {
  cleanup(): Promise<void>;
};

function connectDedicated(): Connection {
  const worker = new Worker(DEDICATED_WORKER_URL, { type: "module" });
  return {
    terminate: () => worker.terminate(),
    api: Comlink.wrap<WorkerApi>(worker),
  };
}

function createDedicatedOwnerApi(): OwnerApi {
  let connection: Connection | null = null;
  let ready: Promise<void> | null = null;

  const ensureConnection = async (): Promise<Comlink.Remote<WorkerApi>> => {
    if (!connection) connection = connectDedicated();
    if (!ready) {
      ready = connection.api.init().catch((err) => {
        ready = null;
        throw err;
      });
    }
    await ready;
    return connection.api;
  };

  return {
    async init(): Promise<void> {
      await ensureConnection();
    },

    async deleteDb(): Promise<void> {
      const api = await ensureConnection();
      await api.deleteDb();
      await this.cleanup();
    },

    async exec(
      sql: string,
      params: BindParam[],
      mode: ExecMode,
      priority: Priority = 1,
    ): Promise<ExecResult> {
      const api = await ensureConnection();
      return api.exec(sql, params, mode, priority);
    },

    async batch(
      steps: ExecStep[],
      options?: { transact?: boolean; priority?: Priority },
    ): Promise<ExecResult[]> {
      const api = await ensureConnection();
      return api.batch(steps, options);
    },

    async subscribeSyncNotifications(
      callback: (notification: SyncNotification) => void,
    ): Promise<number> {
      const api = await ensureConnection();
      return api.subscribeSyncNotifications(Comlink.proxy(callback));
    },

    async unsubscribeSyncNotifications(token: number): Promise<void> {
      const api = await ensureConnection();
      await api.unsubscribeSyncNotifications(token);
    },

    async getPerfStats() {
      const api = await ensureConnection();
      return api.getPerfStats();
    },

    async clearPerfStats() {
      const api = await ensureConnection();
      await api.clearPerfStats();
    },

    async cleanup(): Promise<void> {
      ready = null;
      if (!connection) return;
      try {
        connection.api[Comlink.releaseProxy]();
      } catch {}
      connection.terminate();
      connection = null;
    },
  };
}

function createTabId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function canUseSharedWorker(): boolean {
  return typeof SharedWorker !== "undefined" && typeof MessageChannel !== "undefined";
}

function connectShared(): Connection {
  const sharedWorker = new SharedWorker(sharedWorkerUrl, { type: "module" });
  const ownerChannel = new MessageChannel();
  const ownerApi = createDedicatedOwnerApi();
  const tabId = createTabId();

  Comlink.expose(ownerApi, ownerChannel.port1);
  ownerChannel.port1.start();
  sharedWorker.port.start();
  sharedWorker.port.postMessage(
    { type: "register-tab", tabId, ownerPort: ownerChannel.port2 },
    [ownerChannel.port2],
  );

  return {
    api: Comlink.wrap<WorkerApi>(sharedWorker.port),
    terminate: () => {
      void ownerApi.cleanup();
      sharedWorker.port.close();
    },
  };
}

function connect(): Connection {
  if (!canUseSharedWorker()) return connectDedicated();
  try {
    return connectShared();
  } catch (err) {
    console.warn("[db] SharedWorker unavailable; using dedicated worker", err);
    return connectDedicated();
  }
}

class DbClient {
  private connection: Connection | null = null;
  private ready: Promise<void> | null = null;
  private listeners = new Set<SyncListener>();
  private subscriptionToken: number | null = null;

  private get api(): Comlink.Remote<WorkerApi> {
    if (!this.connection) {
      throw new Error("DbClient.init() must complete before use");
    }
    return this.connection.api;
  }

  onNotification(callback: SyncListener): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  init(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      this.connection = connect();
      await this.connection.api.init();
      // Comlink.proxy keeps the callback callable across MessageChannel; the
      // worker returns a plain numeric token so no functions cross back.
      this.subscriptionToken =
        await this.connection.api.subscribeSyncNotifications(
          Comlink.proxy((notification) => {
            for (const listener of this.listeners) {
              try {
                listener(notification);
              } catch (err) {
                console.error("[db.notify] listener threw", err);
              }
            }
          }),
        );
    })().catch((err) => {
      this.ready = null;
      this.connection = null;
      throw err;
    });
    return this.ready;
  }

  async exec(
    sql: string,
    params: BindParam[] = [],
    mode: ExecMode = "rows",
  ): Promise<ExecResult> {
    await this.init();
    const priority = inferPriority(sql);
    const label = profileLabel(sql);

    const t0 = performance.now();
    return this.api
      .exec(sql, params, mode, priority)
      .finally(() => {
        recordSample(`rt.${label}`, performance.now() - t0, t0);
      });
  }

  async batch(
    steps: Array<{ sql: string; params?: BindParam[]; mode?: ExecMode }>,
    options?: { transact?: boolean; priority?: Priority },
  ): Promise<ExecResult[]> {
    await this.init();
    const normalized: ExecStep[] = steps.map((step) => ({
      sql: step.sql,
      params: step.params ?? [],
      mode: step.mode ?? "run",
    }));
    const label = profileLabel(steps[0]?.sql ?? "") + ".batch";
    const t0 = performance.now();
    return this.api.batch(normalized, options).finally(() => {
      recordSample(`rt.${label}`, performance.now() - t0, t0);
    });
  }

  async stats(): Promise<{
    tab: Record<string, PerfStats>;
    worker: Record<string, PerfStats>;
  }> {
    await this.init();
    const worker = await this.api.getPerfStats();
    return { tab: getTabStats(), worker };
  }

  async clearStats(): Promise<void> {
    clearTabStats();
    if (this.connection) await this.connection.api.clearPerfStats();
  }

  async deleteDb(): Promise<void> {
    await this.init();
    await this.api.deleteDb();
    await this.cleanup();
  }

  async cleanup(): Promise<void> {
    if (this.connection && this.subscriptionToken != null) {
      try {
        await this.connection.api.unsubscribeSyncNotifications(
          this.subscriptionToken,
        );
      } catch {}
    }
    this.subscriptionToken = null;
    if (this.connection) {
      try {
        this.connection.api[Comlink.releaseProxy]();
      } catch {}
      this.connection.terminate();
      this.connection = null;
    }
    this.ready = null;
  }
}

export type { ExecResult };

export const dbClient = new DbClient();

if (import.meta.env.DEV && typeof window !== "undefined") {
  const w = window as Window & {
    __db?: {
      stats: () => Promise<void>;
      raw: () => Promise<unknown>;
      clear: () => Promise<void>;
    };
  };
  w.__db = {
    raw: () => dbClient.stats(),
    clear: () => dbClient.clearStats(),
    stats: async () => {
      const { tab, worker } = await dbClient.stats();
      const fmt = (s: PerfStats) => ({
        count: s.count,
        avg: +s.avg.toFixed(1),
        p50: +s.p50.toFixed(1),
        p95: +s.p95.toFixed(1),
        p99: +s.p99.toFixed(1),
        max: +s.max.toFixed(1),
      });
      console.group("[db] worker (exec time)");
      console.table(
        Object.fromEntries(
          Object.entries(worker)
            .sort((a, b) => b[1].p95 - a[1].p95)
            .map(([k, v]) => [k, fmt(v)]),
        ),
      );
      console.groupEnd();
      console.group("[db] tab (roundtrip)");
      console.table(
        Object.fromEntries(
          Object.entries(tab)
            .sort((a, b) => b[1].p95 - a[1].p95)
            .map(([k, v]) => [k, fmt(v)]),
        ),
      );
      console.groupEnd();
    },
  };
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void dbClient.cleanup();
  });
}
