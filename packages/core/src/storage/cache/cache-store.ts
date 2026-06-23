import { SqliteCache } from './sqlite-cache.js';

/**
 * 通用 JSON 文档缓存 —— 按 scope 分区的键值存储。
 *
 * 每条记录是 (scope, key) → value(字符串,通常为 JSON)。
 * scope 隔离不同用途(chapter-summaries / batch-summaries / search-idx / action-log / …),
 * 让多类缓存共享同一份 db 文件。G04-S02/S03/S04 在此之上叠加专用语义。
 */
export interface CacheDoc {
  key: string;
  value: string;
  updatedAt: string;
}

const UPSERT_SQL = `
  INSERT INTO cache_documents (scope, key, value, updated_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(scope, key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`;

export class CacheStore {
  constructor(
    private readonly cache: SqliteCache,
    readonly scope: string,
  ) {
    this.ensureTable();
  }

  private ensureTable(): void {
    this.cache.exec(`
      CREATE TABLE IF NOT EXISTS cache_documents (
        scope      TEXT NOT NULL,
        key        TEXT NOT NULL,
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (scope, key)
      );
    `);
  }

  private now(): string {
    return new Date().toISOString();
  }

  /** 写入 / 覆盖单条 */
  put(key: string, value: string): void {
    this.cache.run(UPSERT_SQL, [this.scope, key, value, this.now()]);
  }

  /** 批量写入(单事务,统一时间戳) */
  putMany(entries: ReadonlyArray<{ key: string; value: string }>): void {
    if (entries.length === 0) return;
    const ts = this.now();
    this.cache.transaction(() => {
      for (const e of entries) {
        this.cache.run(UPSERT_SQL, [this.scope, e.key, e.value, ts]);
      }
    });
  }

  /** 读取单条,不存在返回 null */
  get(key: string): string | null {
    const row = this.cache.queryOne<{ value: string }>(
      'SELECT value FROM cache_documents WHERE scope = ? AND key = ?',
      [this.scope, key],
    );
    return row?.value ?? null;
  }

  /** 是否存在 */
  has(key: string): boolean {
    const row = this.cache.queryOne<{ key: string }>(
      'SELECT key FROM cache_documents WHERE scope = ? AND key = ?',
      [this.scope, key],
    );
    return row !== undefined;
  }

  /** 删除单条,返回是否真的删了 */
  delete(key: string): boolean {
    const r = this.cache.run('DELETE FROM cache_documents WHERE scope = ? AND key = ?', [
      this.scope,
      key,
    ]);
    return r.changes > 0;
  }

  /** 列出本 scope 全部文档(按 key 排序) */
  list(): CacheDoc[] {
    const rows = this.cache.queryAll<{ key: string; value: string; updated_at: string }>(
      'SELECT key, value, updated_at FROM cache_documents WHERE scope = ? ORDER BY key',
      [this.scope],
    );
    return rows.map((r) => ({ key: r.key, value: r.value, updatedAt: r.updated_at }));
  }

  /** 仅取全部 value(按 key 排序) */
  listValues(): string[] {
    return this.list().map((d) => d.value);
  }

  /** 本 scope 文档数 */
  count(): number {
    const row = this.cache.queryOne<{ c: number }>(
      'SELECT COUNT(*) AS c FROM cache_documents WHERE scope = ?',
      [this.scope],
    );
    return row?.c ?? 0;
  }

  /** 清空本 scope 全部文档 */
  clear(): void {
    this.cache.run('DELETE FROM cache_documents WHERE scope = ?', [this.scope]);
  }
}
