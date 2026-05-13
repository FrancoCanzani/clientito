import { clearStats, getStats, recordSample } from "./perf";
import {
  deleteDb as coreDeleteDb,
  exec as coreExec,
  initDb,
  profileLabel,
  shouldProfile,
} from "./worker-core";
import type {
  BatchOptions,
  BindParam,
  ExecMode,
  ExecResult,
  ExecStep,
  Priority,
  SyncNotification,
  WorkerApi,
} from "./types";

const QUEUE_DEPTH_WARN = 50;
// After this many consecutive P0 dequeues, force one P1 drain so background
// writes cannot starve behind a steady stream of small reads.
const MAX_P0_STREAK = 8;
// Coalesce sync notifications so a burst of writes produces one fan-out.
const NOTIFICATION_FLUSH_MS = 50;

type Task<T> = {
  priority: Priority;
  run: () => T | Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

type SyncListener = (notification: SyncNotification) => void;

type PendingNotification = {
  tables: Set<string>;
  providerMessageIds: Set<string>;
  threadIds: Set<string>;
  mailboxId?: number;
};

function detectWriteTable(sql: string): string | null {
  const trimmed = sql.trimStart();
  const head = trimmed.slice(0, 6).toUpperCase();
  if (head !== "INSERT" && head !== "UPDATE" && head !== "DELETE") return null;
  return (
    /INTO\s+(\w+)/i.exec(trimmed)?.[1] ??
    /UPDATE\s+(\w+)/i.exec(trimmed)?.[1] ??
    /FROM\s+(\w+)/i.exec(trimmed)?.[1] ??
    null
  );
}

export function createWorkerApi(): WorkerApi {
  const p0: Task<unknown>[] = [];
  const p1: Task<unknown>[] = [];
  let processing = false;
  let p0Streak = 0;

  const listeners = new Map<number, SyncListener>();
  let nextToken = 1;
  let pendingNotification: PendingNotification | null = null;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  function trackWrite(sql: string): void {
    const table = detectWriteTable(sql);
    if (!table) return;
    if (!pendingNotification) {
      pendingNotification = {
        tables: new Set(),
        providerMessageIds: new Set(),
        threadIds: new Set(),
      };
    }
    pendingNotification.tables.add(table);
  }

  function flushNotifications(): void {
    flushTimer = null;
    if (!pendingNotification || pendingNotification.tables.size === 0) {
      pendingNotification = null;
      return;
    }
    const notification: SyncNotification = {
      tables: Array.from(pendingNotification.tables),
      providerMessageIds:
        pendingNotification.providerMessageIds.size > 0
          ? Array.from(pendingNotification.providerMessageIds)
          : undefined,
      threadIds:
        pendingNotification.threadIds.size > 0
          ? Array.from(pendingNotification.threadIds)
          : undefined,
      mailboxId: pendingNotification.mailboxId,
    };
    pendingNotification = null;
    for (const listener of listeners.values()) {
      try {
        listener(notification);
      } catch (err) {
        console.error("[db.notify] listener threw", err);
      }
    }
  }

  function scheduleFlush(): void {
    if (flushTimer) return;
    flushTimer = setTimeout(flushNotifications, NOTIFICATION_FLUSH_MS);
  }

  function pickNext(): Task<unknown> | undefined {
    if (p0.length > 0 && p0Streak < MAX_P0_STREAK) {
      p0Streak++;
      return p0.shift();
    }
    p0Streak = 0;
    if (p1.length > 0) return p1.shift();
    if (p0.length > 0) return p0.shift();
    return undefined;
  }

  async function drain(): Promise<void> {
    try {
      for (;;) {
        const task = pickNext();
        if (!task) break;
        try {
          const value = await task.run();
          task.resolve(value);
        } catch (err) {
          task.reject(err instanceof Error ? err : new Error(String(err)));
        }
      }
    } finally {
      processing = false;
    }
  }

  function enqueue<T>(task: Task<T>): void {
    (task.priority === 0 ? p0 : p1).push(task as Task<unknown>);
    const total = p0.length + p1.length;
    if (total === QUEUE_DEPTH_WARN) {
      console.warn(`[db.queue] depth=${total} p0=${p0.length} p1=${p1.length}`);
    }
    if (processing) return;
    processing = true;
    void drain();
  }

  function schedule<T>(priority: Priority, run: () => T | Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      enqueue<T>({ priority, run, resolve, reject });
    });
  }

  function runExec(
    sql: string,
    params: BindParam[],
    mode: ExecMode,
  ): ExecResult {
    trackWrite(sql);
    const label = shouldProfile(sql) ? profileLabel(sql) : "";
    const t0 = label ? performance.now() : 0;
    const result = coreExec(sql, params, mode);
    if (label) recordSample(label, performance.now() - t0, t0);
    scheduleFlush();
    return result;
  }

  return {
    async init(): Promise<void> {
      await initDb();
    },

    async deleteDb(): Promise<void> {
      await coreDeleteDb();
    },

    async exec(
      sql: string,
      params: BindParam[],
      mode: ExecMode,
      priority: Priority = 1,
    ): Promise<ExecResult> {
      await initDb();
      return schedule(priority, () => runExec(sql, params, mode));
    },

    async batch(
      steps: ExecStep[],
      options?: BatchOptions,
    ): Promise<ExecResult[]> {
      await initDb();
      const priority = options?.priority ?? 1;
      const transact = options?.transact === true;
      return schedule(priority, () => {
        for (const step of steps) trackWrite(step.sql);
        if (transact) coreExec("BEGIN IMMEDIATE", [], "run");
        const results: ExecResult[] = [];
        const batchT0 = performance.now();
        try {
          for (const step of steps) {
            const label = shouldProfile(step.sql) ? profileLabel(step.sql) : "";
            const t0 = label ? performance.now() : 0;
            results.push(coreExec(step.sql, step.params, step.mode));
            if (label) recordSample(label, performance.now() - t0, t0);
          }
          if (transact) coreExec("COMMIT", [], "run");
        } catch (err) {
          if (transact) {
            try {
              coreExec("ROLLBACK", [], "run");
            } catch {}
          }
          throw err;
        }
        recordSample("db.batch", performance.now() - batchT0, batchT0);
        scheduleFlush();
        return results;
      });
    },

    async subscribeSyncNotifications(
      callback: SyncListener,
    ): Promise<number> {
      const token = nextToken++;
      listeners.set(token, callback);
      return token;
    },

    async unsubscribeSyncNotifications(token: number): Promise<void> {
      listeners.delete(token);
    },

    async getPerfStats() {
      return getStats();
    },

    async clearPerfStats() {
      clearStats();
    },
  };
}
