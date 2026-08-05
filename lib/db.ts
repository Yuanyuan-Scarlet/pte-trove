import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { databasePath } from "./runtime";

const statements = [
  `CREATE TABLE IF NOT EXISTS material_versions (
    id TEXT PRIMARY KEY, display_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at INTEGER NOT NULL, published_at INTEGER, generation_deadline INTEGER, expires_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS material_assets (
    id TEXT PRIMARY KEY, material_version_id TEXT NOT NULL, material_type TEXT NOT NULL,
    source_storage_key TEXT NOT NULL, original_filename TEXT NOT NULL, file_size INTEGER NOT NULL,
    page_count INTEGER NOT NULL, checksum TEXT NOT NULL, validation_status TEXT NOT NULL, created_at INTEGER NOT NULL,
    UNIQUE(material_version_id, material_type)
  )`,
  `CREATE TABLE IF NOT EXISTS product_links (
    id TEXT PRIMARY KEY, material_version_id TEXT NOT NULL, product_entry TEXT NOT NULL,
    token_ciphertext TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL,
    UNIQUE(material_version_id, product_entry)
  )`,
  `CREATE TABLE IF NOT EXISTS buyer_bindings (
    id TEXT PRIMARY KEY, material_version_id TEXT NOT NULL, product_entry TEXT NOT NULL,
    phone TEXT NOT NULL, order_number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', created_at INTEGER NOT NULL,
    UNIQUE(material_version_id, product_entry, phone),
    UNIQUE(material_version_id, product_entry, order_number)
  )`,
  `CREATE TABLE IF NOT EXISTS generation_jobs (
    id TEXT PRIMARY KEY, buyer_binding_id TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
    error_code TEXT, attempt_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
    started_at INTEGER, completed_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS generated_files (
    id TEXT PRIMARY KEY, generation_job_id TEXT NOT NULL UNIQUE, storage_key TEXT NOT NULL,
    download_filename TEXT NOT NULL, mime_type TEXT NOT NULL, file_size INTEGER NOT NULL,
    checksum TEXT NOT NULL, generated_at INTEGER NOT NULL, archive_at INTEGER NOT NULL,
    archived_at INTEGER, archive_storage_key TEXT, status TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS manual_generations (
    id TEXT PRIMARY KEY, material_version_id TEXT NOT NULL, product_entry TEXT NOT NULL,
    salutation TEXT NOT NULL, phone TEXT NOT NULL, status TEXT NOT NULL, error_code TEXT,
    storage_key TEXT, download_filename TEXT, mime_type TEXT, file_size INTEGER, checksum TEXT,
    generated_at INTEGER, archive_at INTEGER, archived_at INTEGER, archive_storage_key TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS buyer_sessions (
    id TEXT PRIMARY KEY, buyer_binding_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS otp_challenges (
    id TEXT PRIMARY KEY, phone TEXT NOT NULL, code_hash TEXT NOT NULL, purpose TEXT NOT NULL,
    ip TEXT NOT NULL, expires_at INTEGER NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0,
    consumed_at INTEGER, created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL, revoked_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS admin_login_attempts (
    id TEXT PRIMARY KEY, ip TEXT NOT NULL, succeeded INTEGER NOT NULL, created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS generated_archive_idx ON generated_files(status, archive_at)`,
  `CREATE INDEX IF NOT EXISTS manual_version_created_idx ON manual_generations(material_version_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS manual_archive_idx ON manual_generations(status, archive_at)`,
  `CREATE INDEX IF NOT EXISTS buyer_session_binding_idx ON buyer_sessions(buyer_binding_id)`,
  `CREATE INDEX IF NOT EXISTS otp_phone_created_idx ON otp_challenges(phone, created_at)`,
  `CREATE INDEX IF NOT EXISTS otp_ip_created_idx ON otp_challenges(ip, created_at)`,
  `CREATE INDEX IF NOT EXISTS admin_login_ip_created_idx ON admin_login_attempts(ip, created_at)`,
];

type BindValue = string | number | bigint | null | Uint8Array;

export interface RunResult {
  meta: {
    changes: number;
    lastRowId: number | bigint;
  };
}

let connection: Database.Database | null = null;
let schemaReady = false;

function getDatabase(): Database.Database {
  if (connection) return connection;
  const filePath = databasePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o750 });
  connection = new Database(filePath);
  connection.pragma("journal_mode = WAL");
  connection.pragma("synchronous = NORMAL");
  connection.pragma("foreign_keys = ON");
  connection.pragma("busy_timeout = 5000");
  return connection;
}

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  const database = getDatabase();
  database.transaction(() => {
    for (const statement of statements) database.exec(statement);
  })();
  schemaReady = true;
}

export async function first<T>(sql: string, ...values: BindValue[]): Promise<T | null> {
  await ensureSchema();
  return (getDatabase().prepare(sql).get(...values) as T | undefined) ?? null;
}

export async function all<T>(sql: string, ...values: BindValue[]): Promise<T[]> {
  await ensureSchema();
  return getDatabase().prepare(sql).all(...values) as T[];
}

export async function run(sql: string, ...values: BindValue[]): Promise<RunResult> {
  await ensureSchema();
  const result = getDatabase().prepare(sql).run(...values);
  return { meta: { changes: result.changes, lastRowId: result.lastInsertRowid } };
}

export interface BatchStatement {
  sql: string;
  values?: BindValue[];
}

export async function batch(items: BatchStatement[]): Promise<RunResult[]> {
  await ensureSchema();
  const execute = getDatabase().transaction((entries: BatchStatement[]) => entries.map((item) => {
    const result = getDatabase().prepare(item.sql).run(...(item.values ?? []));
    return { meta: { changes: result.changes, lastRowId: result.lastInsertRowid } };
  }));
  return execute(items);
}

export function closeDatabase(): void {
  connection?.close();
  connection = null;
  schemaReady = false;
}
