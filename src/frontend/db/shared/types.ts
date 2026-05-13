export type BindParam = string | number | boolean | null | Uint8Array;

export type ExecMode = "rows" | "run" | "get";

/** 0 = fast lane (small reads, metadata). 1 = everything else, including writes. */
export type Priority = 0 | 1;

export type ExecStep = {
  sql: string;
  params: BindParam[];
  mode: ExecMode;
};

export type Cell = string | number | bigint | null | Uint8Array;
export type Row = Cell[];

export type ExecResult = {
  rows: Row[];
  columns: string[];
};

export type SyncNotification = {
  tables: string[];
  providerMessageIds?: string[];
  threadIds?: string[];
  mailboxId?: number;
};

export type BatchOptions = {
  transact?: boolean;
  priority?: Priority;
};

export type PerfStats = {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  avg: number;
};

/**
 * The full transport surface between a tab and the database worker.
 *
 * Comlink wraps a Remote<WorkerApi> on the tab side; the worker side calls
 * Comlink.expose with an object implementing this interface. Every value
 * crossing this boundary is structured-cloneable — in particular, the
 * subscription API uses an opaque numeric token instead of returning an
 * unsubscribe function, because functions are not cloneable over postMessage.
 */
export interface WorkerApi {
  init(): Promise<void>;
  deleteDb(): Promise<void>;
  exec(
    sql: string,
    params: BindParam[],
    mode: ExecMode,
    priority?: Priority,
  ): Promise<ExecResult>;
  batch(steps: ExecStep[], options?: BatchOptions): Promise<ExecResult[]>;
  /**
   * Register a callback (wrapped on the caller side with Comlink.proxy)
   * to receive sync notifications. Returns a token that can be passed
   * to {@link unsubscribeSyncNotifications}.
   */
  subscribeSyncNotifications(
    callback: (notification: SyncNotification) => void,
  ): Promise<number>;
  unsubscribeSyncNotifications(token: number): Promise<void>;
  /** Worker-side perf stats (one sample per SQL exec). */
  getPerfStats(): Promise<Record<string, PerfStats>>;
  clearPerfStats(): Promise<void>;
}
