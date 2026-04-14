type BindParam = string | number | boolean | null | Uint8Array;

export type ExecMode = "rows" | "run" | "get";

type RpcRequest =
  | { id: number; type: "init" }
  | { id: number; type: "deleteDb" }
  | {
      id: number;
      type: "exec";
      payload: { sql: string; params: BindParam[]; mode: ExecMode };
    }
  | {
      id: number;
      type: "batch";
      payload: Array<{ sql: string; params: BindParam[]; mode: ExecMode }>;
    };

type RpcResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

export type ExecResult = {
  rows: unknown[][];
  columns: string[];
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

class DbWorkerClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private initPromise: Promise<void> | null = null;

  private getWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./db.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<RpcResponse>) => {
      const msg = event.data;
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (msg.ok) pending.resolve(msg.result);
      else pending.reject(new Error(msg.error));
    };
    this.worker = worker;
    return worker;
  }

  private send<T>(req: RpcRequest): Promise<T> {
    const worker = this.getWorker();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(req.id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      worker.postMessage(req);
    });
  }

  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.send<void>({ id: this.nextId++, type: "init" });
    }
    return this.initPromise;
  }

  async exec(
    sql: string,
    params: BindParam[] = [],
    mode: ExecMode = "rows",
  ): Promise<ExecResult> {
    await this.init();
    return this.send<ExecResult>({
      id: this.nextId++,
      type: "exec",
      payload: { sql, params, mode },
    });
  }

  async batch(
    steps: Array<{ sql: string; params?: BindParam[]; mode?: ExecMode }>,
  ): Promise<ExecResult[]> {
    await this.init();
    return this.send<ExecResult[]>({
      id: this.nextId++,
      type: "batch",
      payload: steps.map((s) => ({
        sql: s.sql,
        params: s.params ?? [],
        mode: s.mode ?? "run",
      })),
    });
  }

  async deleteDb(): Promise<void> {
    await this.send<void>({ id: this.nextId++, type: "deleteDb" });
    this.initPromise = null;
  }

  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pending.clear();
    this.initPromise = null;
  }
}

export const dbClient = new DbWorkerClient();
