type RpcResponse = {
  id: number;
  rows?: unknown[][];
  columns?: string[];
  error?: string;
};

type PendingQuery = {
  resolve: (value: { rows: unknown[][]; columns: string[] }) => void;
  reject: (error: Error) => void;
};

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, PendingQuery>();
let readyResolve: (() => void) | null = null;
const ready = new Promise<void>((r) => {
  readyResolve = r;
});

export function initSqliteRpc() {
  if (worker) return;

  worker = new Worker(new URL("./sqlite-worker.ts", import.meta.url), {
    type: "module",
  });

  worker.onmessage = (event: MessageEvent<RpcResponse | { type: "ready" }>) => {
    if ("type" in event.data && event.data.type === "ready") {
      readyResolve?.();
      return;
    }

    const response = event.data as RpcResponse;
    const pending_query = pending.get(response.id);
    if (!pending_query) return;

    pending.delete(response.id);

    if (response.error) {
      pending_query.reject(new Error(response.error));
    } else {
      pending_query.resolve({
        rows: response.rows ?? [],
        columns: response.columns ?? [],
      });
    }
  };

  worker.postMessage({ id: 0, method: "all", sql: "SELECT 1", params: [] });
  readyResolve?.();
}

export async function execSql(
  sql: string,
  params: unknown[],
  method: "all" | "run" | "get" | "values",
): Promise<{ rows: unknown[][] }> {
  if (!worker) throw new Error("SQLite worker not initialized");

  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, {
      resolve: (result) => resolve({ rows: result.rows }),
      reject,
    });
    worker!.postMessage({ id, method, sql, params });
  });
}

export async function waitForReady(): Promise<void> {
  return ready;
}

export async function deleteDatabase(): Promise<void> {
  if (!worker) throw new Error("SQLite worker not initialized");

  const id = nextId++;
  return new Promise<void>((resolve, reject) => {
    pending.set(id, {
      resolve: () => resolve(),
      reject,
    } as PendingQuery);
    worker!.postMessage({ id, method: "delete-db", sql: "", params: [] });
  });
}
