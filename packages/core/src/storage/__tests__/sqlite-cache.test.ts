import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteCache } from '../cache/sqlite-cache.js';
import { CacheStore } from '../cache/cache-store.js';
import { withFallback, rebuildCache } from '../cache/consistency.js';

describe('SqliteCache', () => {
  let root: string;
  let cache: SqliteCache;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'sw-sqlite-'));
    cache = await SqliteCache.open(join(root, 'cache.db'));
  });

  afterEach(() => {
    cache.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('open 后 schema_version = 1', () => {
    expect(cache.schemaVersion).toBe(1);
  });

  it('exec / run / queryOne / queryAll 基本读写', () => {
    cache.exec('CREATE TABLE t(id INTEGER PRIMARY KEY, name TEXT)');
    cache.run('INSERT INTO t(name) VALUES (?)', ['张三']);
    cache.run('INSERT INTO t(name) VALUES (?)', ['李四']);

    const one = cache.queryOne<{ name: string }>('SELECT name FROM t WHERE id = ?', [1]);
    expect(one?.name).toBe('张三');

    const all = cache.queryAll<{ name: string }>('SELECT name FROM t ORDER BY id');
    expect(all.map((r) => r.name)).toEqual(['张三', '李四']);
  });

  it('run 返回 changes', () => {
    cache.exec('CREATE TABLE t(x INTEGER)');
    const r1 = cache.run('INSERT INTO t(x) VALUES (?)', [1]);
    expect(r1.changes).toBe(1);
    cache.run('INSERT INTO t(x) VALUES (?)', [2]);
    cache.run('INSERT INTO t(x) VALUES (?)', [3]);
    const r2 = cache.run('DELETE FROM t WHERE x > ?', [1]);
    expect(r2.changes).toBe(2);
  });

  it('transaction 原子提交', () => {
    cache.exec('CREATE TABLE t(x INTEGER)');
    cache.transaction(() => {
      cache.run('INSERT INTO t(x) VALUES (?)', [1]);
      cache.run('INSERT INTO t(x) VALUES (?)', [2]);
    });
    expect(cache.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM t')?.c).toBe(2);
  });

  it('transaction 抛错则回滚', () => {
    cache.exec('CREATE TABLE t(x INTEGER UNIQUE)');
    expect(() =>
      cache.transaction(() => {
        cache.run('INSERT INTO t(x) VALUES (?)', [1]);
        cache.run('INSERT INTO t(x) VALUES (?)', [1]); // 唯一约束冲突
      }),
    ).toThrow();
    expect(cache.queryOne<{ c: number }>('SELECT COUNT(*) AS c FROM t')?.c).toBe(0);
  });

  it('close 后重开数据持久化(WAL)', async () => {
    cache.exec('CREATE TABLE t(x INTEGER)');
    cache.run('INSERT INTO t(x) VALUES (?)', [42]);
    cache.close();

    const reopened = await SqliteCache.open(join(root, 'cache.db'));
    try {
      const row = reopened.queryOne<{ x: number }>('SELECT x FROM t');
      expect(row?.x).toBe(42);
    } finally {
      reopened.close();
    }
  });

  it('open 会创建多层目录', async () => {
    cache.close();
    const nested = join(root, 'nested', 'deep', 'cache.db');
    const c = await SqliteCache.open(nested);
    try {
      expect(existsSync(nested)).toBe(true);
    } finally {
      c.close();
    }
  });

  it('queryOne 无结果返回 undefined', () => {
    cache.exec('CREATE TABLE t(x INTEGER)');
    expect(cache.queryOne('SELECT * FROM t')).toBeUndefined();
  });
});

describe('CacheStore', () => {
  let root: string;
  let cache: SqliteCache;
  let store: CacheStore;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'sw-store-'));
    cache = await SqliteCache.open(join(root, 'cache.db'));
    store = new CacheStore(cache, 'summaries');
  });

  afterEach(() => {
    cache.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('put / get 往返', () => {
    store.put('ch001', '{"chapter":1}');
    expect(store.get('ch001')).toBe('{"chapter":1}');
  });

  it('get 不存在返回 null', () => {
    expect(store.get('nope')).toBeNull();
  });

  it('put 覆盖已有值', () => {
    store.put('ch001', 'v1');
    store.put('ch001', 'v2');
    expect(store.get('ch001')).toBe('v2');
  });

  it('has / delete', () => {
    expect(store.has('ch001')).toBe(false);
    store.put('ch001', 'v');
    expect(store.has('ch001')).toBe(true);
    expect(store.delete('ch001')).toBe(true);
    expect(store.has('ch001')).toBe(false);
    expect(store.delete('ch001')).toBe(false);
  });

  it('list / listValues 按 key 排序', () => {
    store.put('ch003', 'c3');
    store.put('ch001', 'c1');
    store.put('ch002', 'c2');
    expect(store.list().map((d) => d.key)).toEqual(['ch001', 'ch002', 'ch003']);
    expect(store.listValues()).toEqual(['c1', 'c2', 'c3']);
  });

  it('count / clear', () => {
    store.put('a', '1');
    store.put('b', '2');
    expect(store.count()).toBe(2);
    store.clear();
    expect(store.count()).toBe(0);
  });

  it('putMany 批量写入(单事务)', () => {
    store.putMany([
      { key: 'ch001', value: 'a' },
      { key: 'ch002', value: 'b' },
      { key: 'ch003', value: 'c' },
    ]);
    expect(store.count()).toBe(3);
    expect(store.get('ch002')).toBe('b');
  });

  it('putMany 空数组不报错', () => {
    store.putMany([]);
    expect(store.count()).toBe(0);
  });

  it('putMany 覆盖已有', () => {
    store.put('ch001', 'old');
    store.putMany([{ key: 'ch001', value: 'new' }]);
    expect(store.get('ch001')).toBe('new');
  });

  it('不同 scope 互相隔离', () => {
    const other = new CacheStore(cache, 'action-log');
    store.put('k', 'summaries-value');
    other.put('k', 'log-value');
    expect(store.get('k')).toBe('summaries-value');
    expect(other.get('k')).toBe('log-value');
    expect(store.count()).toBe(1);
    expect(other.count()).toBe(1);
    // 清空 summaries 不影响 action-log
    store.clear();
    expect(other.get('k')).toBe('log-value');
  });
});

describe('consistency helpers', () => {
  let root: string;
  let cache: SqliteCache;
  let store: CacheStore;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'sw-consistency-'));
    cache = await SqliteCache.open(join(root, 'cache.db'));
    store = new CacheStore(cache, 'summaries');
  });

  afterEach(() => {
    cache.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('withFallback:缓存命中则不读文件', async () => {
    store.put('ch001', 'cached');
    let fileCalled = false;
    const result = await withFallback(
      () => store.get('ch001'),
      async () => {
        fileCalled = true;
        return 'from-file';
      },
    );
    expect(result).toBe('cached');
    expect(fileCalled).toBe(false);
  });

  it('withFallback:缓存缺失降级到文件', async () => {
    const result = await withFallback(
      () => store.get('ch999'),
      async () => 'from-file',
    );
    expect(result).toBe('from-file');
  });

  it('withFallback:缓存读抛错也降级', async () => {
    const result = await withFallback(
      () => {
        throw new Error('cache broken');
      },
      async () => 'from-file',
    );
    expect(result).toBe('from-file');
  });

  it('rebuildCache:清空后从 loader 全量重建', async () => {
    store.put('stale', 'old');
    const n = await rebuildCache(store, async () => [
      { key: 'ch001', value: 'a' },
      { key: 'ch002', value: 'b' },
    ]);
    expect(n).toBe(2);
    expect(store.has('stale')).toBe(false);
    expect(store.count()).toBe(2);
    expect(store.get('ch002')).toBe('b');
  });

  it('rebuildCache:loader 返回空则清空', async () => {
    store.put('a', '1');
    const n = await rebuildCache(store, async () => []);
    expect(n).toBe(0);
    expect(store.count()).toBe(0);
  });
});
