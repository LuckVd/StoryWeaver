import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from '../server.js';

describe('Volumes Routes', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-vol-test-'));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  function server() {
    return createServer(projectRoot).app;
  }

  async function initBook(app: ReturnType<typeof server>) {
    await app.request('/api/v1/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '测试小说', genre: '玄幻', language: 'zh-CN' }),
    });
  }

  it('GET /api/v1/volumes — 返回空列表', async () => {
    const app = server();
    await initBook(app);
    const res = await app.request('/api/v1/volumes');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('POST /api/v1/volumes — 创建新卷', async () => {
    const app = server();
    await initBook(app);
    const res = await app.request('/api/v1/volumes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '第一卷' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(1);
    expect(body.title).toBe('第一卷');
  });

  it('POST /api/v1/volumes — 卷号自增', async () => {
    const app = server();
    await initBook(app);
    await app.request('/api/v1/volumes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '第一卷' }),
    });
    const res = await app.request('/api/v1/volumes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '第二卷' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(2);
  });

  it('PUT /api/v1/volumes/:id — 更新卷标题', async () => {
    const app = server();
    await initBook(app);
    await app.request('/api/v1/volumes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '旧标题' }),
    });
    const res = await app.request('/api/v1/volumes/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '新标题' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('新标题');
  });

  it('PUT /api/v1/volumes/:id — 不存在的卷返回 404', async () => {
    const app = server();
    await initBook(app);
    const res = await app.request('/api/v1/volumes/999', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '新标题' }),
    });
    expect(res.status).toBe(404);
  });
});
