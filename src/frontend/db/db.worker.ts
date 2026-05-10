/// <reference lib="webworker" />
import sqlite3InitModule, {
 type OpfsSAHPoolDatabase,
 type PreparedStatement,
 type SAHPoolUtil,
 type SqlValue,
} from "@sqlite.org/sqlite-wasm";

const DB_FILENAME = "/petit.db";
const SAH_POOL_DIRECTORY = ".petit-sahpool";
const SQLITE_OPTIONAL_OPFS_WARNING =
 "Ignoring inability to install OPFS sqlite3_vfs:";

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
 is_gatekept INTEGER NOT NULL DEFAULT 0,
 ai_category TEXT,
 ai_confidence REAL,
 ai_reason TEXT,
 ai_summary TEXT,
 ai_draft_reply TEXT,
 ai_classified_at INTEGER,
 ai_classification_key TEXT,
 ai_split_ids TEXT,
 created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS emails_user_mailbox_date ON emails(user_id, mailbox_id, date);
CREATE INDEX IF NOT EXISTS emails_thread ON emails(thread_id);
CREATE INDEX IF NOT EXISTS emails_snoozed ON emails(snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS emails_provider_msg ON emails(provider_message_id);
CREATE INDEX IF NOT EXISTS emails_subject ON emails(subject COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS emails_from_name ON emails(from_name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS emails_from_addr ON emails(from_addr COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS email_labels (
 email_id INTEGER NOT NULL,
 user_id TEXT NOT NULL,
 mailbox_id INTEGER,
 label_id TEXT NOT NULL,
 date INTEGER NOT NULL,
 PRIMARY KEY (email_id, label_id)
);

CREATE INDEX IF NOT EXISTS email_labels_view
 ON email_labels(user_id, mailbox_id, label_id, date DESC, email_id DESC);

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

CREATE TABLE IF NOT EXISTS split_views (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 icon TEXT,
 color TEXT,
 position INTEGER NOT NULL DEFAULT 0,
 visible INTEGER NOT NULL DEFAULT 1,
 pinned INTEGER NOT NULL DEFAULT 0,
 is_system INTEGER NOT NULL DEFAULT 0,
 system_key TEXT,
 rules TEXT,
 match_mode TEXT NOT NULL DEFAULT 'rules',
 show_in_other INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS split_views_user_pos ON split_views(user_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS split_views_user_system
 ON split_views(user_id, system_key) WHERE system_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS _meta (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL
);
`;

const PRAGMAS = `
PRAGMA journal_mode = MEMORY;
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

type RpcResponse =
 | { id: number; ok: true; result: unknown }
 | { id: number; ok: false; error: string };

let pool: SAHPoolUtil | null = null;
let db: OpfsSAHPoolDatabase | null = null;
let initPromise: Promise<void> | null = null;
const stmtCache = new Map<string, PreparedStatement>();

type SqliteGlobal = typeof globalThis & {
 sqlite3ApiConfig?: {
 warn?: (...args: unknown[]) => void;
 [key: string]: unknown;
 };
};

function shouldHideOptionalOpfsWarning(args: unknown[]): boolean {
 const message = args.map((arg) => String(arg)).join(" ");
 return (
 message.includes(SQLITE_OPTIONAL_OPFS_WARNING) &&
 message.includes("Missing SharedArrayBuffer")
 );
}

async function initSqlite3Module() {
 const sqliteGlobal = globalThis as SqliteGlobal;
 const existingConfig = sqliteGlobal.sqlite3ApiConfig;
 const existingWarn = existingConfig?.warn;
 sqliteGlobal.sqlite3ApiConfig = {
 ...existingConfig,
 warn: (...args: unknown[]) => {
 if (shouldHideOptionalOpfsWarning(args)) return;
 if (existingWarn) {
 existingWarn(...args);
 } else {
 console.warn(...args);
 }
 },
 };
 return sqlite3InitModule();
}

async function purgeLegacyOpfsDb(): Promise<void> {
 try {
 const root = await navigator.storage.getDirectory();
 const base = DB_FILENAME.replace(/^\//, "");
 for (const name of [base, `${base}-wal`, `${base}-shm`, `${base}-journal`]) {
 try {
 await root.removeEntry(name);
 } catch {
 /* not present */
 }
 }
 } catch {
 /* OPFS unavailable */
 }
}

async function purgeSahPoolDirectory(): Promise<void> {
 try {
 const root = await navigator.storage.getDirectory();
 await root.removeEntry(SAH_POOL_DIRECTORY, { recursive: true });
 } catch {
 /* OPFS unavailable or directory not present */
 }
}

function isInvalidStateError(error: unknown): boolean {
 return (
 error instanceof DOMException
 ? error.name === "InvalidStateError"
 : error instanceof Error &&
 (error.name === "InvalidStateError" ||
 error.message.includes("invalid state"))
 );
}

function closeDb(): void {
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
}

async function resetSahPoolAfterInvalidState(): Promise<void> {
 closeDb();
 const activePool = pool;
 pool = null;
 if (activePool) {
 try {
 await activePool.wipeFiles();
 } catch {
 /* pool may already be in an invalid state */
 }
 try {
 activePool.pauseVfs();
 } catch {
 /* ignore */
 }
 }
 await purgeSahPoolDirectory();
}

async function installPool(): Promise<SAHPoolUtil> {
 const sqlite3 = await initSqlite3Module();
 if (typeof sqlite3.installOpfsSAHPoolVfs !== "function") {
 throw new Error("sqlite-wasm SAH-Pool VFS unavailable in this browser");
 }
 await purgeLegacyOpfsDb();
 pool = await sqlite3.installOpfsSAHPoolVfs({
 directory: SAH_POOL_DIRECTORY,
 initialCapacity: 32,
 });
 return pool;
}

async function ensurePool(): Promise<SAHPoolUtil> {
 if (pool) return pool;
 return installPool();
}

async function initDb(): Promise<void> {
 if (db) return;
 if (initPromise) return initPromise;

 const initialize = async () => {
 const activePool = await ensurePool();
 db = new activePool.OpfsSAHPoolDb(DB_FILENAME);
 db.exec(PRAGMAS);
 db.exec(SCHEMA_SQL);
 };

 initPromise = (async () => {
 try {
 await initialize();
 } catch (error) {
 if (!isInvalidStateError(error)) throw error;
 await resetSahPoolAfterInvalidState();
 await initialize();
 }
 })();

 try {
 await initPromise;
 } catch (error) {
 initPromise = null;
 closeDb();
 pool = null;
 throw error;
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

type ExecResult = { rows: SqlValue[][]; columns: string[] };

function exec(sql: string, params: BindParam[], mode: ExecMode): ExecResult {
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
 initPromise = null;
 if (pool) {
 try {
 await pool.wipeFiles();
 } catch {
 /* ignore */
 }
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
 case "exec":
 await initDb();
 return exec(req.payload.sql, req.payload.params, req.payload.mode);
 case "batch": {
 await initDb();
 const results: ExecResult[] = [];
 for (const step of req.payload) {
 results.push(exec(step.sql, step.params, step.mode));
 }
 return results;
 }
 }
}

self.onmessage = async (event: MessageEvent<RpcRequest>) => {
 const req = event.data;
 let response: RpcResponse;
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
};
