import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from '../server.js';

describe('Workspace Routes', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-ws-test-'));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  function server() {
    return createServer(projectRoot).app;
  }

  /** 创建书籍 + 卷 + 章节的完整 setup */
  async function setup(app: ReturnType<typeof server>, chapterCount = 3) {
    // 创建书籍
    await app.request('/api/v1/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '测试小说', genre: '玄幻', language: 'zh-CN' }),
    });
    // 创建卷
    await app.request('/api/v1/volumes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '第一卷' }),
    });
    // 创建章节
    const chapterIds: number[] = [];
    for (let i = 1; i <= chapterCount; i++) {
      const res = await app.request('/api/v1/chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume: 1, title: `第${i}章` }),
      });
      chapterIds.push((await res.json()).id);
    }
    return chapterIds;
  }

  // ── GET /workspace ──

  it('GET /workspace — 自动创建空工作区', async () => {
    const app = server();
    const res = await app.request('/api/v1/workspace');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chapterIds).toEqual([]);
    expect(body.chapters).toEqual([]);
    expect(body.createdAt).toBeDefined();
  });

  // ── POST /workspace/chapters ──

  it('POST /workspace/chapters — 添加章节到工作区', async () => {
    const app = server();
    const [id] = await setup(app, 1);

    const res = await app.request('/api/v1/workspace/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId: id }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.chapterIds).toContain(id);
  });

  it('POST /workspace/chapters — 重复添加报错', async () => {
    const app = server();
    const [id] = await setup(app, 1);

    await app.request('/api/v1/workspace/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId: id }),
    });
    const res = await app.request('/api/v1/workspace/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId: id }),
    });
    expect(res.status).toBe(400);
  });

  // ── DELETE /workspace/chapters/:id ──

  it('DELETE /workspace/chapters/:id — 移除章节', async () => {
    const app = server();
    const [id] = await setup(app, 1);

    await app.request('/api/v1/workspace/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId: id }),
    });
    const res = await app.request(`/api/v1/workspace/chapters/${id}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chapterIds).not.toContain(id);
  });

  it('DELETE /workspace/chapters/:id — 不存在返回 404', async () => {
    const app = server();
    const res = await app.request('/api/v1/workspace/chapters/999', {
      method: 'DELETE',
    });
    expect(res.status).toBe(404);
  });

  // ── POST /workspace/publish ──

  it('POST /workspace/publish — 发布 approved 章节并从工作区移除', async () => {
    const app = server();
    const ids = await setup(app, 2);

    // 添加到工作区
    for (const id of ids) {
      await app.request('/api/v1/workspace/chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId: id }),
      });
    }
    // 转为 approved
    for (const id of ids) {
      await app.request(`/api/v1/chapters/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
    }

    // 发布（跳过 AI 摘要）
    const res = await app.request('/api/v1/workspace/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterIds: ids, skipSummary: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.published).toEqual(ids);
    expect(body.skipped).toEqual(ids);

    // 工作区应已清空
    const wsRes = await app.request('/api/v1/workspace');
    const ws = await wsRes.json();
    expect(ws.chapterIds).toEqual([]);
  });

  it('POST /workspace/publish — 非 approved 章节报错', async () => {
    const app = server();
    const [id] = await setup(app, 1);

    await app.request('/api/v1/workspace/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId: id }),
    });

    const res = await app.request('/api/v1/workspace/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterIds: [id] }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.message).toContain('未定稿');
  });

  it('POST /workspace/publish — 不在工作区的章节报错', async () => {
    const app = server();
    const ids = await setup(app, 1);

    const res = await app.request('/api/v1/workspace/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterIds: ids }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /workspace/publish — 空数组报错', async () => {
    const app = server();
    const res = await app.request('/api/v1/workspace/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterIds: [] }),
    });
    expect(res.status).toBe(400);
  });

  // ── 集成：发布后章节不可修改 ──

  it('发布后章节内容不可修改', async () => {
    const app = server();
    const [id] = await setup(app, 1);

    // approved → publish 完整流程
    await app.request('/api/v1/workspace/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId: id }),
    });
    await app.request(`/api/v1/chapters/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    await app.request('/api/v1/workspace/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterIds: [id], skipSummary: true }),
    });

    // 尝试修改内容
    const res = await app.request(`/api/v1/chapters/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '尝试修改' }),
    });
    expect(res.status).toBe(423);
  });
});
