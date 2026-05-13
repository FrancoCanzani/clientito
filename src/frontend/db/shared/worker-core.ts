import sqlite3InitModule, {
  type OpfsSAHPoolDatabase,
  type PreparedStatement,
  type SAHPoolUtil,
  type SqlValue,
} from "@sqlite.org/sqlite-wasm";
import { DB_FILENAME, PRAGMAS, SAH_POOL_DIR, SCHEMA_SQL } from "./schema";

export type { BindParam, ExecMode, ExecResult } from "./types";
import type { BindParam, ExecMode, ExecResult } from "./types";

const stmtCache = new Map<string, PreparedStatement>();

let pool: SAHPoolUtil | null = null;
let db: OpfsSAHPoolDatabase | null = null;
let initPromise: Promise<void> | null = null;

type SqliteGlobal = typeof globalThis & {
  sqlite3ApiConfig?: {
    warn?: (...args: unknown[]) => void;
    [key: string]: unknown;
  };
};

export async function initDb(): Promise<void> {
  if (db) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const sqliteGlobal = globalThis as SqliteGlobal;
    sqliteGlobal.sqlite3ApiConfig = {
      ...sqliteGlobal.sqlite3ApiConfig,
      warn: (...args: unknown[]) => {
        const msg = args.join(" ");
        if (
          msg.includes("opfs-sahpool") ||
          msg.includes("NoModificationAllowedError") ||
          msg.includes("Ignoring inability") ||
          msg.includes("removeVfs")
        )
          return;
        console.warn(...args);
      },
    };

    const sqlite3 = await sqlite3InitModule();
    if (typeof sqlite3.installOpfsSAHPoolVfs !== "function") {
      throw new Error("sqlite-wasm SAH-Pool VFS unavailable in this browser");
    }

    let lastErr: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        pool = await sqlite3.installOpfsSAHPoolVfs({
          directory: SAH_POOL_DIR,
          initialCapacity: 32,
        });
        break;
      } catch (e) {
        lastErr = e;
        if (attempt < 4)
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
    if (!pool) throw lastErr;

    db = new pool.OpfsSAHPoolDb(DB_FILENAME);
    db.exec(PRAGMAS);
    db.exec(SCHEMA_SQL);
  })();

  try {
    await initPromise;
  } catch (e) {
    initPromise = null;
    throw e;
  }
}

export function normalizeParams(params: BindParam[]): SqlValue[] {
  return params.map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p));
}

function getStmt(sql: string): PreparedStatement {
  if (!db) throw new Error("DB not initialized");
  const cached = stmtCache.get(sql);
  if (cached) return cached;
  const stmt = db.prepare(sql);
  stmtCache.set(sql, stmt);
  return stmt;
}

export function exec(
  sql: string,
  params: BindParam[],
  mode: ExecMode,
): ExecResult {
  if (!db) throw new Error("DB not initialized");
  const stmt = getStmt(sql);
  // SqlValue covers the same shapes we accept (string/number/bigint/null/
  // typed-array). All BLOB columns in this database are Uint8Array — Int8Array
  // is a SqlValue corner case we don't store. Cast once here so the rest of
  // the pipeline carries our typed Row through unchanged.
  const rows = [] as SqlValue[][];
  let columns: string[] = [];
  try {
    if (params.length > 0) stmt.bind(normalizeParams(params));
    if (mode === "run") {
      while (stmt.step()) { /* drain */ }
    } else if (mode === "get") {
      if (stmt.step()) {
        columns = stmt.getColumnNames();
        rows.push(stmt.get([]));
      }
    } else {
      let gotColumns = false;
      while (stmt.step()) {
        if (!gotColumns) {
          columns = stmt.getColumnNames();
          gotColumns = true;
        }
        rows.push(stmt.get([]));
      }
    }
    return { rows: rows as ExecResult["rows"], columns };
  } finally {
    stmt.reset(true);
  }
}

export function shouldProfile(sql: string): boolean {
  const s = sql.trimStart().toUpperCase();
  return (
    s.startsWith("SELECT") ||
    s.startsWith("INSERT") ||
    s.startsWith("UPDATE") ||
    s.startsWith("DELETE")
  );
}

export function profileLabel(sql: string): string {
  const s = sql.trimStart();
  const firstWord = s.slice(0, s.indexOf(" ")).toUpperCase();
  const tableHint =
    /FROM\s+(\w+)/i.exec(s)?.[1] ??
    /INTO\s+(\w+)/i.exec(s)?.[1] ??
    /UPDATE\s+(\w+)/i.exec(s)?.[1] ??
    "";
  const limit = s.includes("LIMIT 1") ? ":1" : "";
  return `db.${firstWord}.${tableHint}${limit}`;
}

export function isReadSql(sql: string): boolean {
  const s = sql.trimStart().toUpperCase();
  return s.startsWith("SELECT") || s.startsWith("PRAGMA");
}

export async function deleteDb(): Promise<void> {
  for (const stmt of stmtCache.values()) {
    try {
      stmt.finalize();
    } catch {}
  }
  stmtCache.clear();
  if (db) {
    try {
      db.close();
    } catch {}
    db = null;
  }
  initPromise = null;
  if (pool) {
    try {
      await pool.wipeFiles();
    } catch {}
  }
}