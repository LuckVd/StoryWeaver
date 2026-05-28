import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { InMemorySearchEngine } from '@storyweaver/core';
import { searchRoute } from '../routes/search.js';
import { errorHandler } from '../error-handler.js';

describe('Search Route', () => {
  let app: Hono;
  let engine: InMemorySearchEngine;

  beforeEach(() => {
    engine = new InMemorySearchEngine();
    engine.indexChapter(1, '第一章 起点', '张三住在天元宗山脚下的村庄');
    engine.indexChapter(2, '第二章 修炼', '张三开始修炼，每天坚持练功');
    engine.indexKnowledge('char-zhangsan', '张三', '主角少年，天赋异禀');

    app = new Hono();
    app.onError(errorHandler);
    app.route('/api/v1/search', searchRoute(engine));
  });

  it('GET /search?q=... — 搜索并返回结果', async () => {
    const res = await app.request('/api/v1/search?q=张三');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.query).toBe('张三');
    expect(body.scope).toBe('all');
    expect(body.total).toBeGreaterThan(0);
    expect(body.results).toBeInstanceOf(Array);
    expect(body.results[0].type).toBeDefined();
    expect(body.results[0].title).toBeDefined();
    expect(body.results[0].snippet).toBeDefined();
  });

  it('GET /search?q=...&scope=chapters — scope 过滤', async () => {
    const res = await app.request('/api/v1/search?q=张三&scope=chapters');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scope).toBe('chapters');
    expect(body.results.every((r: { type: string }) => r.type === 'chapter')).toBe(true);
  });

  it('GET /search — 空关键词返回 400', async () => {
    const res = await app.request('/api/v1/search?q=');
    expect(res.status).toBe(400);
  });

  it('GET /search — 无 q 参数返回 400', async () => {
    const res = await app.request('/api/v1/search');
    expect(res.status).toBe(400);
  });

  it('GET /search — 无效 scope 返回 400', async () => {
    const res = await app.request('/api/v1/search?q=test&scope=invalid');
    expect(res.status).toBe(400);
  });

  it('GET /search — 无匹配结果返回空数组', async () => {
    const res = await app.request('/api/v1/search?q=不存在xyz');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(0);
    expect(body.results).toEqual([]);
  });
});
