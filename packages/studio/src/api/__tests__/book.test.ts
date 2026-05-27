import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BookStorage } from '@storyweaver/core';
import { createServer } from '../server.js';

describe('Book Routes', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-book-test-'));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  function server() {
    return createServer(projectRoot).app;
  }

  it('POST /api/v1/book — 创建书籍', async () => {
    const app = server();
    const res = await app.request('/api/v1/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '测试小说', genre: '玄幻', language: 'zh-CN' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('测试小说');
    expect(body.status).toBe('drafting');
    expect(body.nextChapterId).toBe(1);
    expect(body.nextVolumeId).toBe(1);
    expect(body.volumes).toEqual([]);
  });

  it('POST /api/v1/book — 重复创建返回错误', async () => {
    const app = server();
    await app.request('/api/v1/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '测试小说', genre: '玄幻', language: 'zh-CN' }),
    });
    const res = await app.request('/api/v1/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '另一本', genre: '都市', language: 'zh-CN' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/v1/book — 不存在返回 404', async () => {
    const app = server();
    const res = await app.request('/api/v1/book');
    expect(res.status).toBe(404);
  });

  it('GET /api/v1/book — 存在时返回书籍', async () => {
    const app = server();
    await app.request('/api/v1/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '测试', genre: '玄幻', language: 'zh-CN' }),
    });
    const res = await app.request('/api/v1/book');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('测试');
  });

  it('PUT /api/v1/book — 更新书籍信息', async () => {
    const app = server();
    await app.request('/api/v1/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '旧标题', genre: '玄幻', language: 'zh-CN' }),
    });
    const res = await app.request('/api/v1/book', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '新标题', status: 'in_progress' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('新标题');
    expect(body.status).toBe('in_progress');
  });

  it('PUT /api/v1/book — 书籍不存在返回 404', async () => {
    const app = server();
    const res = await app.request('/api/v1/book', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '新标题' }),
    });
    expect(res.status).toBe(404);
  });
});
