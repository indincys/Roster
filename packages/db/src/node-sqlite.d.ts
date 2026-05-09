declare module "node:sqlite" {
  export type SqliteValue = string | number | bigint | Buffer | null;

  export interface StatementResultingChanges {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export interface StatementSync {
    run(...params: SqliteValue[]): StatementResultingChanges;
    get(...params: SqliteValue[]): Record<string, unknown> | undefined;
    all(...params: SqliteValue[]): Array<Record<string, unknown>>;
  }

  export class DatabaseSync {
    constructor(location: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
