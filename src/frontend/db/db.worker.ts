/// <reference lib="webworker" />
import sqlite3InitModule, {
  type OpfsDatabase,
  type PreparedStatement,
  type Sqlite3Static,
  type SqlValue,
} from "@sqlite.org/sqlite-wasm";

const DB_FILENAME = "/petit.db";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  mailbox_id INTEGER,
  provider_message_id TEXT NOT NULL UNIQUE,
  thread_id TEXT,
  from_addr TEXT NOT NULL,
  from_name TEXT,
  to_addr TEXT,
  cc_addr TEXT,
  subject TEXT,
  snippet TEXT,
  body_text TEXT,
  body_html TEXT,
  date INTEGER NOT NULL,
  direction TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  label_ids TEXT,
  has_inbox INTEGER NOT NULL DEFAULT 0,
  has_sent INTEGER NOT NULL DEFAULT 0,
  has_trash INTEGER NOT NULL DEFAULT 0,
  has_spam INTEGER NOT NULL DEFAULT 0,
  has_starred INTEGER NOT NULL DEFAULT 0,
  unsubscribe_url TEXT,
  unsubscribe_email TEXT,
  snoozed_until INTEGER,
  inline_attachments TEXT,
  attachments TEXT,
  has_calendar INTEGER NOT NULL DEFAULT 0,
  ai_category TEXT,
  ai_confidence REAL,
  ai_reason TEXT,
  ai_summary TEXT,
  ai_draft_reply TEXT,
  ai_classified_at INTEGER,
  ai_classification_key TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS emails_user_mailbox_date ON emails(user_id, mailbox_id, date);
CREATE INDEX IF NOT EXISTS emails_thread ON emails(thread_id);
CREATE INDEX IF NOT EXISTS emails_snoozed ON emails(snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS emails_provider_msg ON emails(provider_message_id);
CREATE INDEX IF NOT EXISTS emails_subject ON emails(subject COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS emails_from_name ON emails(from_name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS emails_from_addr ON emails(from_addr COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS labels (
  gmail_id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  mailbox_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'user',
  text_color TEXT,
  background_color TEXT,
  messages_total INTEGER NOT NULL DEFAULT 0,
  messages_unread INTEGER NOT NULL DEFAULT 0,
  synced_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS labels_user_mailbox ON labels(user_id, mailbox_id);

CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  compose_key TEXT NOT NULL,
  mailbox_id INTEGER,
  to_addr TEXT NOT NULL DEFAULT '',
  cc_addr TEXT NOT NULL DEFAULT '',
  bcc_addr TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  forwarded_content TEXT NOT NULL DEFAULT '',
  thread_id TEXT,
  attachment_keys TEXT,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, compose_key)
);

CREATE INDEX IF NOT EXISTS drafts_updated ON drafts(updated_at);

CREATE TABLE IF NOT EXISTS _meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const PRAGMAS = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -8000;
PRAGMA temp_store = MEMORY;
`;

type BindParam = SqlValue | boolean;

type ExecMode = "rows" | "run" | "get";

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

type RpcResponseOk = {
  id: number;
  ok: true;
  result: unknown;
};

type RpcResponseErr = {
  id: number;
  ok: false;
  error: string;
};

let sqlite3: Sqlite3Static | null = null;
let db: OpfsDatabase | null = null;
const stmtCache = new Map<string, PreparedStatement>();

async function initDb(): Promise<void> {
  if (db) return;
  sqlite3 = await sqlite3InitModule();
  if (!sqlite3.oo1.OpfsDb) {
    throw new Error("OPFS not available — check COOP/COEP headers");
  }
  db = new sqlite3.oo1.OpfsDb(DB_FILENAME);
  db.exec(PRAGMAS);
  db.exec(SCHEMA_SQL);
  ensureEmailColumn(db, "inline_attachments", "TEXT");
  ensureEmailColumn(db, "attachments", "TEXT");
  ensureEmailColumn(db, "has_calendar", "INTEGER");
  ensureEmailColumn(db, "ai_category", "TEXT");
  ensureEmailColumn(db, "ai_confidence", "REAL");
  ensureEmailColumn(db, "ai_reason", "TEXT");
  ensureEmailColumn(db, "ai_summary", "TEXT");
  ensureEmailColumn(db, "ai_draft_reply", "TEXT");
  ensureEmailColumn(db, "ai_classified_at", "INTEGER");
  ensureEmailColumn(db, "ai_classification_key", "TEXT");
}

function ensureEmailColumn(
  database: OpfsDatabase,
  column: string,
  type: string,
): void {
  try {
    const stmt = database.prepare("PRAGMA table_info(emails)");
    let exists = false;
    try {
      while (stmt.step()) {
        const row = stmt.get({}) as Record<string, unknown>;
        if (row.name === column) {
          exists = true;
          break;
        }
      }
    } finally {
      stmt.finalize();
    }
    if (!exists) {
      database.exec(`ALTER TABLE emails ADD COLUMN ${column} ${type}`);
    }
  } catch {
    /* ignore */
  }
}

function getStmt(sql: string): PreparedStatement {
  if (!db) throw new Error("DB not initialized");
  const cached = stmtCache.get(sql);
  if (cached) return cached;
  const stmt = db.prepare(sql);
  stmtCache.set(sql, stmt);
  return stmt;
}

function normalizeParams(params: BindParam[]): SqlValue[] {
  return params.map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p));
}

function exec(sql: string, params: BindParam[], mode: ExecMode): {
  rows: SqlValue[][];
  columns: string[];
} {
  if (!db) throw new Error("DB not initialized");
  const stmt = getStmt(sql);
  const rows: SqlValue[][] = [];
  let columns: string[] = [];
  try {
    if (params.length > 0) {
      stmt.bind(normalizeParams(params));
    }
    if (mode === "run") {
      while (stmt.step()) {
        /* drain */
      }
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
    return { rows, columns };
  } finally {
    stmt.reset(true);
  }
}

async function deleteDb(): Promise<void> {
  for (const stmt of stmtCache.values()) {
    try {
      stmt.finalize();
    } catch {
      /* ignore */
    }
  }
  stmtCache.clear();
  if (db) {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    db = null;
  }
  const root = await navigator.storage.getDirectory();
  const path = DB_FILENAME.replace(/^\//, "");
  try {
    await root.removeEntry(path);
  } catch {
    /* ignore */
  }
}

async function handle(req: RpcRequest): Promise<unknown> {
  switch (req.type) {
    case "init":
      await initDb();
      return null;
    case "deleteDb":
      await deleteDb();
      return null;
    case "exec": {
      await initDb();
      return exec(req.payload.sql, req.payload.params, req.payload.mode);
    }
    case "batch": {
      await initDb();
      const results: ReturnType<typeof exec>[] = [];
      for (const step of req.payload) {
        results.push(exec(step.sql, step.params, step.mode));
      }
      return results;
    }
  }
}

let queue: Promise<void> = Promise.resolve();

self.onmessage = (event: MessageEvent<RpcRequest>) => {
  const req = event.data;
  queue = queue.then(async () => {
    let response: RpcResponseOk | RpcResponseErr;
    try {
      const result = await handle(req);
      response = { id: req.id, ok: true, result };
    } catch (error) {
      response = {
        id: req.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    self.postMessage(response);
  });
};
