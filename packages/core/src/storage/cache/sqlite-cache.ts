import { DatabaseSync } from 'node:sqlite';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * SQLite 缓存引擎
 *
 * G04 引入的文件存储加速层。设计原则(见 roadmap G04):
 * - 文件(JSON + Markdown)是唯一主存储,SQLite 仅作索引 / 缓存;
 * - 缓存可随时删除并从文件全量重建,db 放 memory/.cache/(已 gitignore)。
 *
 * 基于 Node 22.5+ 内置的 node:sqlite(实验性,运行需 --experimental-sqlite)。
 * API 与 better-sqlite3 对齐,便于将来切换实现。
 */

/** 当前缓存 schema 版本,用于将来迁移 */
export const CACHE_SCHEMA_VERSION = 1;

interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

type Statement = ReturnType<DatabaseSync['prepare']>;

export class SqliteCache {
  private readonly db: DatabaseSync;
  private readonly statements = new Map<string, Statement>();
  readonly dbPath: string;

  private constructor(db: DatabaseSync, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  /** 打开(或创建)缓存数据库并初始化 pragma / 元信息表 */
  static async open(dbPath: string): Promise<SqliteCache> {
    await mkdir(dirname(dbPath), { recursive: true });
    const db = new DatabaseSync(dbPath);
    const cache = new SqliteCache(db, dbPath);
    cache.applyPragmas();
    cache.ensureMeta();
    return cache;
  }

  private applyPragmas(): void {
    // WAL 提升并发写性能;-wal / -shm 也落在 .cache/ 内(已 gitignore)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA temp_store = MEMORY;
    `);
  }

  private ensureMeta(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _cache_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    const row = this.db
      .prepare('SELECT value FROM _cache_meta WHERE key = ?')
      .get('schema_version') as { value: string } | undefined;
    if (!row) {
      this.db
        .prepare('INSERT INTO _cache_meta(key, value) VALUES (?, ?)')
        .run('schema_version', String(CACHE_SCHEMA_VERSION));
    }
  }

  get schemaVersion(): number {
    const row = this.db
      .prepare('SELECT value FROM _cache_meta WHERE key = ?')
      .get('schema_version') as { value: string } | undefined;
    return row ? Number(row.value) : 0;
  }

  /** 执行多条 SQL(DDL 等),无返回 */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /** 预编译语句缓存(同 SQL 复用,减少 prepare 开销) */
  private stmt(sql: string): Statement {
    let s = this.statements.get(sql);
    if (!s) {
      s = this.db.prepare(sql);
      this.statements.set(sql, s);
    }
    return s;
  }

  /** 执行写操作(INSERT/UPDATE/DELETE),返回影响行数等 */
  run(sql: string, params: unknown[] = []): RunResult {
    return this.stmt(sql).run(...params) as RunResult;
  }

  /** 查询单行,无结果返回 undefined */
  queryOne<T>(sql: string, params: unknown[] = []): T | undefined {
    return this.stmt(sql).get(...params) as T | undefined;
  }

  /** 查询所有行 */
  queryAll<T>(sql: string, params: unknown[] = []): T[] {
    return this.stmt(sql).all(...params) as T[];
  }

  /**
   * 事务:fn 内操作原子提交,抛错自动回滚。
   *
   * Node 22.x 的 node:sqlite 尚未提供 db.transaction(),这里用
   * BEGIN / COMMIT / ROLLBACK 自行实现(等价,跨版本可用)。
   */
  transaction<T>(fn: () => T): T {
    this.exec('BEGIN');
    try {
      const result = fn();
      this.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        this.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw err;
    }
  }

  close(): void {
    try {
      this.db.close();
    } catch {
      /* 已关闭则忽略 */
    }
  }
}
