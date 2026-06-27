import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibraryStorage } from '../library-storage.js';
import { bookDir } from '../path.js';
import type { Book } from '../../models/index.js';

describe('LibraryStorage', () => {
  let libraryRoot: string;
  let storage: LibraryStorage;

  const makeBook = (overrides: Partial<Book> = {}): Book => ({
    title: '示例',
    genre: '科幻',
    language: 'zh',
    status: 'drafting',
    createdAt: '2026-06-27T00:00:00Z',
    updatedAt: '2026-06-27T00:00:00Z',
    nextChapterId: 1,
    nextVolumeId: 1,
    volumes: [],
    ...overrides,
  });

  beforeAll(() => {
    libraryRoot = mkdtempSync(join(tmpdir(), 'sw-lib-test-'));
    storage = new LibraryStorage(libraryRoot);
  });

  afterAll(() => {
    rmSync(libraryRoot, { recursive: true, force: true });
  });

  it('空书架 list 返回空数组', async () => {
    expect(await storage.list()).toEqual([]);
  });

  it('createBook 建目录 + exists 为真 + 可读回', async () => {
    await storage.createBook('bk-aaaa01', makeBook({ title: '星河边缘' }));
    expect(storage.exists('bk-aaaa01')).toBe(true);
    const book = await storage.readBook('bk-aaaa01');
    expect(book?.title).toBe('星河边缘');
  });

  it('重复 slug createBook 抛 BOOK_ALREADY_EXISTS', async () => {
    await expect(storage.createBook('bk-aaaa01', makeBook({ title: 'dup' }))).rejects.toThrow(
      'BOOK_ALREADY_EXISTS',
    );
  });

  it('非法 slug createBook 抛 INVALID_SLUG', async () => {
    await expect(storage.createBook('../escape', makeBook())).rejects.toThrow('INVALID_SLUG');
  });

  it('list 返回所有书并按 updatedAt 倒序', async () => {
    await storage.createBook('bk-older', makeBook({ title: '旧书', updatedAt: '2026-01-01T00:00:00Z' }));
    await storage.createBook('bk-newer', makeBook({ title: '新书', updatedAt: '2026-12-01T00:00:00Z' }));
    const items = await storage.list();
    expect(items).toHaveLength(3);
    expect(items[0].slug).toBe('bk-newer'); // 最新在前
    expect(items.map((i) => i.title)).toEqual(
      expect.arrayContaining(['星河边缘', '旧书', '新书']),
    );
  });

  it('BookshelfItem 概览字段正确(含 volumeCount)', async () => {
    await storage.createBook(
      'bk-vols',
      makeBook({ title: '多卷书', volumes: [{ id: 1, title: '第一卷', createdAt: 'x' }] }),
    );
    const item = (await storage.list()).find((i) => i.slug === 'bk-vols');
    expect(item?.volumeCount).toBe(1);
    expect(item?.genre).toBe('科幻');
  });

  it('generateSlug 生成 bk- 前缀且不与现有冲突', async () => {
    const slug = await storage.generateSlug();
    expect(slug).toMatch(/^bk-[a-z0-9]+$/);
    expect(storage.exists(slug)).toBe(false);
  });

  it('current 指针读写', async () => {
    expect(await storage.getCurrent()).toBeNull();
    await storage.setCurrent('bk-aaaa01');
    expect(await storage.getCurrent()).toBe('bk-aaaa01');
  });

  it('bookDir 拒绝路径遍历', () => {
    expect(() => bookDir(libraryRoot, '../escape')).toThrow();
  });

  it('updateBookMeta 合并 patch + 刷新 updatedAt + 持久化', async () => {
    await storage.createBook('bk-edit', makeBook({ title: '原名' }));
    const updated = await storage.updateBookMeta('bk-edit', { title: '新名', author: '作者甲' });
    expect(updated.title).toBe('新名');
    expect(updated.author).toBe('作者甲');
    expect(updated.updatedAt).not.toBe('2026-06-27T00:00:00Z'); // updatedAt 已刷新
    const reread = await storage.readBook('bk-edit');
    expect(reread?.title).toBe('新名');
    expect(reread?.author).toBe('作者甲');
  });

  it('updateBookMeta 不存在抛 BOOK_NOT_FOUND', async () => {
    await expect(storage.updateBookMeta('bk-nope', { title: 'x' })).rejects.toThrow('BOOK_NOT_FOUND');
  });

  it('deleteBook 删除目录', async () => {
    await storage.createBook('bk-del', makeBook({ title: '待删' }));
    expect(storage.exists('bk-del')).toBe(true);
    await storage.deleteBook('bk-del');
    expect(storage.exists('bk-del')).toBe(false);
  });

  it('deleteBook 不存在抛 BOOK_NOT_FOUND', async () => {
    await expect(storage.deleteBook('bk-nope')).rejects.toThrow('BOOK_NOT_FOUND');
  });
});
