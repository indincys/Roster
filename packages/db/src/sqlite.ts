import { createRequire } from "node:module";

export type SqliteValue = string | number | bigint | Buffer | null;

export interface SqliteStatement {
  run(...params: SqliteValue[]): unknown;
  get(...params: SqliteValue[]): Record<string, unknown> | undefined;
  all(...params: SqliteValue[]): Record<string, unknown>[];
}

export interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

type SqliteDatabaseConstructor = new (location: string) => SqliteDatabase;

export interface SqlMigration {
  id: string;
  sql: string;
}

export async function openSqliteDatabase(location: string): Promise<SqliteDatabase> {
  const require = createRequire(import.meta.url);
  if (process.versions.electron) {
    const BetterSqlite = require("better-sqlite3") as SqliteDatabaseConstructor;
    return new BetterSqlite(location);
  }

  const nodeSqlite = require("node:sqlite") as {
    DatabaseSync: SqliteDatabaseConstructor;
  };
  return new nodeSqlite.DatabaseSync(location);
}

export function applySqlMigrations(db: SqliteDatabase, migrations: SqlMigration[]): void {
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );`
  );

  for (const migration of migrations) {
    const existing = db.prepare("SELECT id FROM schema_migrations WHERE id = ?").get(migration.id);
    if (existing) {
      continue;
    }

    db.exec("BEGIN IMMEDIATE;");
    try {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(
        migration.id,
        new Date().toISOString()
      );
      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }
  }
}
