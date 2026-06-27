import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLibraryServer } from '../library-server.js';

describe('Library Server(书架调度层)', () => {
  let libraryRoot: string;
  let handle: ReturnType<typeof createLibraryServer>;
  let app: ReturnType<typeof createLibraryServer>['app'];

  beforeAll(() => {
    libraryRoot = mkdtempSync(join(tmpdir(), 'sw-libsrv-test-'));
    handle = createLibraryServer(libraryRoot);
    app = handle.app;
  });

  afterAll(async () => {
    await handle.dispose();
    rmSync(libraryRoot, { recursive: true, force: true });
  });

  it('空书架:GET /library 返回空列表 + null current', async () => {
    const res = await app.request('/api/v1/library');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.books).toEqual([]);
    expect(body.current).toBeNull();
  });

  it('空书架:GET /book 返回"尚无打开的书"(404)', async () => {
    const res = await app.request('/api/v1/book');
    expect(res.status).toBe(404);
  });

  it('POST /library 新建第一本并自动激活', async () => {
    const res = await app.request('/api/v1/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '第一本', genre: '科幻', language: 'zh' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.book.title).toBe('第一本');
    expect(body.slug).toMatch(/^bk-/);

    // 激活后 GET /book 返回新书
    const bookRes = await app.request('/api/v1/book');
    expect(bookRes.status).toBe(200);
    expect((await bookRes.json()).title).toBe('第一本');
  });

  it('POST /library 新建第二本并切换到新书', async () => {
    const res = await app.request('/api/v1/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '第二本', genre: '玄幻', language: 'zh' }),
    });
    expect(res.status).toBe(201);
    const bookRes = await app.request('/api/v1/book');
    expect((await bookRes.json()).title).toBe('第二本');
  });

  let firstSlug = '';

  it('GET /library 列出两本书', async () => {
    const res = await app.request('/api/v1/library');
    const body = await res.json();
    expect(body.books).toHaveLength(2);
    const first = body.books.find((b: { title: string }) => b.title === '第一本');
    expect(first).toBeDefined();
    firstSlug = first.slug;
  });

  it('POST /library/:slug/activate 切回第一本', async () => {
    const res = await app.request(`/api/v1/library/${firstSlug}/activate`, { method: 'POST' });
    expect(res.status).toBe(200);
    const bookRes = await app.request('/api/v1/book');
    expect((await bookRes.json()).title).toBe('第一本');
  });

  it('activate 不存在的书返回 404', async () => {
    const res = await app.request('/api/v1/library/bk-nope/activate', { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it('GET /library 的 current 指向当前书', async () => {
    const res = await app.request('/api/v1/library');
    const body = await res.json();
    expect(body.current).toBe(firstSlug);
  });

  it('PUT /library/:slug 编辑指定书(非当前书)', async () => {
    const list = await (await app.request('/api/v1/library')).json();
    const second = list.books.find((b: { title: string }) => b.title === '第二本');
    expect(second).toBeDefined();
    const res = await app.request(`/api/v1/library/${second.slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '第二本改名', author: '新作者' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('第二本改名');
    expect(body.author).toBe('新作者');
  });

  it('PUT /library/:slug 不存在返回 404', async () => {
    const res = await app.request('/api/v1/library/bk-nope', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'x' }),
    });
    expect(res.status).toBe(404);
  });

  it('GET /library/:slug/export 导出指定书(Markdown)', async () => {
    const list = await (await app.request('/api/v1/library')).json();
    const slug = list.books[0].slug;
    const res = await app.request(`/api/v1/library/${slug}/export?format=md`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
  });

  it('DELETE /library/:slug 删除非当前书', async () => {
    const list = await (await app.request('/api/v1/library')).json();
    const second = list.books.find((b: { title: string }) => b.title === '第二本改名');
    const res = await app.request(`/api/v1/library/${second.slug}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    const after = await (await app.request('/api/v1/library')).json();
    expect(after.books).toHaveLength(1);
    expect(after.current).toBe(firstSlug); // 当前书不变
  });

  it('DELETE 当前书 → 自动清空(fallback 为空)', async () => {
    const before = await (await app.request('/api/v1/library')).json();
    expect(before.current).toBe(firstSlug);
    const res = await app.request(`/api/v1/library/${firstSlug}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    // active 已清空 → GET /book 返回 404
    const bookRes = await app.request('/api/v1/book');
    expect(bookRes.status).toBe(404);
    const after = await (await app.request('/api/v1/library')).json();
    expect(after.books).toEqual([]);
    expect(after.current).toBeNull();
  });
});
