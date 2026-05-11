type BindParam = string | number | boolean | null | Uint8Array;
type ExecMode = "rows" | "run" | "get";

function profileLabel(sql: string): string {
  const s = sql.trimStart();
  const firstWord = s.slice(0, s.indexOf(" ")).toUpperCase();
  const tableHint = /FROM\s+(\w+)/i.exec(s)?.[1] ?? /INTO\s+(\w+)/i.exec(s)?.[1] ?? /UPDATE\s+(\w+)/i.exec(s)?.[1] ?? "";
  const limit = s.includes("LIMIT 1") ? ":1" : "";
  return `db.${firstWord}.${tableHint}${limit}`;
}

type RpcRequest =
  | { id: number; type: "init" }
  | { id: number; type: "deleteDb" }
  | { id: number; type: "exec"; payload: { sql: string; params: BindParam[]; mode: ExecMode } }
  | { id: number; type: "batch"; payload: Array<{ sql: string; params: BindParam[]; mode: ExecMode }>; transact?: boolean }

type RpcResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string }

export type ExecResult = { rows: unknown[][]; columns: string[] };

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

const LOCK_NAME = "duomo-db";
const CHANNEL_NAME = "duomo-db";
const HEARTBEAT_INTERVAL = 3000;
const HEARTBEAT_DEAD = 8000;

class DbClient {
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private role: "uninitialized" | "primary" | "secondary" = "uninitialized";
  private worker: Worker | null = null;
  private channel: BroadcastChannel | null = null;
  private initPromise: Promise<void> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private lastHeartbeat = 0;

  private startPrimary() {
    this.role = "primary";
    this.worker = new Worker(new URL("./db.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<RpcResponse>) => this.onWorkerMessage(e.data);
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = (e: MessageEvent) => {
      const data = e.data;
      if (data && data.type === "heartbeat") return;
      if (data && data.id != null && data.type) this.serveProxyRequest(data as RpcRequest);
    };
    this.heartbeatTimer = setInterval(() => {
      this.channel?.postMessage({ type: "heartbeat" });
    }, HEARTBEAT_INTERVAL);
  }

  private startSecondary() {
    this.role = "secondary";
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = (e: MessageEvent) => {
      const data = e.data;
      if (data && data.type === "heartbeat") {
        this.lastHeartbeat = Date.now();
        return;
      }
      if (data && data.id != null && data.ok != null) this.onResponse(data as RpcResponse);
    };
    this.lastHeartbeat = Date.now();
    this.watchdogTimer = setInterval(() => {
      if (Date.now() - this.lastHeartbeat > HEARTBEAT_DEAD) this.promote();
    }, 2000);
  }

  private async promote() {
    this.cleanup();
    const acquired = await this.acquireLock();
    if (acquired) {
      this.startPrimary();
    } else {
      this.startSecondary();
    }
    this.initPromise = null;
  }

  private acquireLock(): Promise<boolean> {
    return new Promise((resolve) => {
      navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
        resolve(!!lock);
        return new Promise(() => {});
      });
    });
  }

  private onWorkerMessage(msg: RpcResponse) {
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    msg.ok ? p.resolve(msg.result) : p.reject(new Error(msg.error));
  }

  private onResponse(msg: RpcResponse) {
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    msg.ok ? p.resolve(msg.result) : p.reject(new Error(msg.error));
  }

  private async serveProxyRequest(req: RpcRequest) {
    try {
      if (!this.worker) await this.ensureInit();
      const result = await this.sendToWorker(req);
      this.channel?.postMessage({ id: req.id, ok: true, result } as RpcResponse);
    } catch (error) {
      this.channel?.postMessage({
        id: req.id, ok: false,
        error: error instanceof Error ? error.message : String(error),
      } as RpcResponse);
    }
  }

  private sendToWorker<T>(req: RpcRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      this.pending.set(req.id, { resolve: (v) => resolve(v as T), reject });
      this.worker!.postMessage(req);
    });
  }

  private sendToChannel<T>(req: RpcRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      this.pending.set(req.id, { resolve: (v) => resolve(v as T), reject });
      this.channel!.postMessage(req);
    });
  }

  private send<T>(req: RpcRequest): Promise<T> {
    return this.role === "primary"
      ? this.sendToWorker<T>(req)
      : this.sendToChannel<T>(req);
  }

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      if (this.role === "uninitialized") {
        const acquired = await this.acquireLock();
        if (acquired) { this.startPrimary(); } else { this.startSecondary(); }
      }
      await this.send<void>({ id: this.nextId++, type: "init" });
    })();
    try {
      await this.initPromise;
    } catch (e) {
      this.initPromise = null;
      throw e;
    }
  }

  async exec(sql: string, params: BindParam[] = [], mode: ExecMode = "rows"): Promise<ExecResult> {
    await this.init();
    const label = profileLabel(sql);
    const t0 = label ? performance.now() : 0;
    const result = await this.send<ExecResult>({ id: this.nextId++, type: "exec", payload: { sql, params, mode } });
    if (label) {
      const ms = performance.now() - t0;
      if (ms > 100) console.warn(`[db-roundtrip] ${label} ${ms.toFixed(1)}ms`);
    }
    return result;
  }

  async batch(
    steps: Array<{ sql: string; params?: BindParam[]; mode?: ExecMode }>,
    options?: { transact?: boolean },
  ): Promise<ExecResult[]> {
    await this.init();
    return this.send<ExecResult[]>({
      id: this.nextId++,
      type: "batch",
      payload: steps.map((s) => ({ sql: s.sql, params: s.params ?? [], mode: s.mode ?? "run" })),
      transact: options?.transact ?? false,
    });
  }

  async deleteDb(): Promise<void> {
    await this.send<void>({ id: this.nextId++, type: "deleteDb" });
    this.initPromise = null;
  }

  private ensureInit(): Promise<void> { return this.init(); }

  cleanup() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.watchdogTimer) { clearInterval(this.watchdogTimer); this.watchdogTimer = null; }
    if (this.channel) { this.channel.close(); this.channel = null; }
    if (this.worker) { this.worker.terminate(); this.worker = null; }
    this.pending.clear();
    this.initPromise = null;
    this.role = "uninitialized";
  }
}

export const dbClient = new DbClient();

if (import.meta.hot) {
  import.meta.hot.dispose(() => { dbClient.cleanup(); });
}