import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from '../server.js';

describe('Chapters Routes', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-ch-test-'));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  function server() {
    return createServer(projectRoot).app;
  }

  async function setup(app: ReturnType<typeof server>) {
    await app.request('/api/v1/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '测试小说', genre: '玄幻', language: 'zh-CN' }),
    });
    await app.request('/api/v1/volumes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '第一卷' }),
    });
  }

  it('POST /api/v1/chapters — 创建章节', async () => {
    const app = server();
    await setup(app);
    const res = await app.request('/api/v1/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: 1, title: '第一章 起点' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(1);
    expect(body.title).toBe('第一章 起点');
    expect(body.volume).toBe(1);
    expect(body.status).toBe('draft');
    expect(body.content).toBe('');
  });

  it('POST /api/v1/chapters — 章节ID自增', async () => {
    const app = server();
    await setup(app);
    await app.request('/api/v1/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: 1, title: '第一章' }),
    });
    const res = await app.request('/api/v1/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: 1, title: '第二章' }),
    });
    expect(res.status).toBe(201);
    expect((await res.json()).id).toBe(2);
  });

  it('POST /api/v1/chapters — 不存在的卷返回 404', async () => {
    const app = server();
    await setup(app);
    const res = await app.request('/api/v1/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: 999, title: '测试' }),
    });
    expect(res.status).toBe(404);
  });

  it('GET /api/v1/chapters — 列出所有章节', async () => {
    const app = server();
    await setup(app);
    await app.request('/api/v1/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: 1, title: '第一章' }),
    });
    await app.request('/api/v1/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: 1, title: '第二章' }),
    });
    const res = await app.request('/api/v1/chapters');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  it('GET /api/v1/chapters?volume=1 — 按卷过滤', async () => {
    const app = server();
    await setup(app);
    // 创建第二卷
    await app.request('/api/v1/volumes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '第二卷' }),
    });
    await app.request('/api/v1/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: 1, title: '第一章' }),
    });
    await app.request('/api/v1/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: 2, title: '第二章' }),
    });
    const res = await app.request('/api/v1/chapters?volume=1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe('第一章');
  });

  it('GET /api/v1/chapters/:id — 获取章节详情', async () => {
    const app = server();
    await setup(app);
    await app.request('/api/v1/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: 1, title: '第一章' }),
    });
    const res = await app.request('/api/v1/chapters/1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);
    expect(body.title).toBe('第一章');
    expect(body.volume).toBe(1);
  });

  it('GET /api/v1/chapters/:id — 不存在返回 404', async () => {
    const app = server();
    await setup(app);
    const res = await app.request('/api/v1/chapters/999');
    expect(res.status).toBe(404);
  });

  it('PUT /api/v1/chapters/:id — 更新章节内容', async () => {
    const app = server();
    await setup(app);
    await app.request('/api/v1/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: 1, title: '第一章' }),
    });
    const res = await app.request('/api/v1/chapters/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '新标题', content: '这是正文内容。' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('新标题');
    expect(body.content).toBe('这是正文内容。');
  });

  it('DELETE /api/v1/chapters/:id — 删除 draft 章节', async () => {
    const app = server();
    await setup(app);
    await app.request('/api/v1/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: 1, title: '第一章' }),
    });
    const res = await app.request('/api/v1/chapters/1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    // 确认已删除
    const getRes = await app.request('/api/v1/chapters/1');
    expect(getRes.status).toBe(404);
  });

  it('DELETE /api/v1/chapters/:id — 非 draft 状态不可删除', async () => {
    const app = server();
    await setup(app);
    await app.request('/api/v1/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: 1, title: '第一章' }),
    });
    // 先转为 approved
    await app.request('/api/v1/chapters/1/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    const res = await app.request('/api/v1/chapters/1', { method: 'DELETE' });
    expect(res.status).toBe(423);
  });

  it('PUT /api/v1/chapters/:id/status — draft→approved', async () => {
    const app = server();
    await setup(app);
    await app.request('/api/v1/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: 1, title: '第一章' }),
    });
    const res = await app.request('/api/v1/chapters/1/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('approved');
  });

  it('PUT /api/v1/chapters/:id/status — approved→published', async () => {
    const app = server();
    await setup(app);
    await app.request('/api/v1/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: 1, title: '第一章' }),
    });
    await app.request('/api/v1/chapters/1/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    const res = await app.request('/api/v1/chapters/1/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('published');
    expect(body.publishedAt).toBeDefined();
  });

  it('PUT /api/v1/chapters/:id/status — 非法流转返回错误', async () => {
    const app = server();
    await setup(app);
    await app.request('/api/v1/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: 1, title: '第一章' }),
    });
    // draft → published 不合法（需要先 approved）
    const res = await app.request('/api/v1/chapters/1/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT /api/v1/chapters/:id — published 章节不可修改', async () => {
    const app = server();
    await setup(app);
    await app.request('/api/v1/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: 1, title: '第一章' }),
    });
    await app.request('/api/v1/chapters/1/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    await app.request('/api/v1/chapters/1/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' }),
    });
    const res = await app.request('/api/v1/chapters/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '新标题' }),
    });
    expect(res.status).toBe(423);
  });
});
