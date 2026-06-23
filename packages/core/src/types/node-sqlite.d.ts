/**
 * node:sqlite 最小类型声明
 *
 * Node 22.5+ 内置实验性 `node:sqlite` 模块(运行需 --experimental-sqlite)。
 * 当前 @types/node 暂未收录其类型,这里声明项目用到的最小子集。
 * 升级 @types/node 至含 node:sqlite 后可删除本文件。
 *
 * @see https://nodejs.org/api/sqlite.html
 */

declare module 'node:sqlite' {
  interface StatementResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  class StatementSync {
    run(...params: unknown[]): StatementResult;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    iterate(...params: unknown[]): IterableIterator<unknown>;
    setAllowBareNamedParameters(enabled: boolean): void;
    setReadBigInts(readBigInts: boolean): void;
    readonly sourceSQL: string;
    readonly expandedSQL: string;
  }

  interface DatabaseSyncOptions {
    open?: boolean;
    enableForeignKeyConstraints?: boolean;
    enableDoubleQuotedStringLiterals?: boolean;
    allowExtension?: boolean;
  }

  class DatabaseSync {
    constructor(location: string, options?: DatabaseSyncOptions);
    open(): void;
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    function(name: string, fn: (...args: unknown[]) => unknown): void;
    aggregate(name: string, options: object): void;
    backup(file: string): Promise<void>;
    diskhandle(): unknown;
    applyChangeset(changeset: Uint8Array): boolean;
    createSession(options?: object): { close(): void; changeset: Uint8Array };
    // 注:db.transaction() 在 Node 23.4+ 才提供;本项目用 BEGIN/COMMIT/ROLLBACK 自行实现,故不在此声明。
  }
}
