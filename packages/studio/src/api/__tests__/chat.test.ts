import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { routeUserMessage } from '@storyweaver/core';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from '../server.js';

// Mock @storyweaver/core 的 Agent 和 LLM 模块
vi.mock('@storyweaver/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@storyweaver/core')>();
  return {
    ...actual,
    routeUserMessage: vi.fn().mockResolvedValue('writer'),
    WriterAgent: vi.fn().mockImplementation(() => ({
      name: 'writer',
      writeStream: async function* () {
        yield '你好';
        yield '，';
        yield '世界';
      },
    })),
    BrainstormerAgent: vi.fn().mockImplementation(() => ({
      name: 'brainstormer',
      brainstormStream: async function* () {
        yield '构思';
        yield '结果';
      },
    })),
    AuditorAgent: vi.fn().mockImplementation(() => ({
      name: 'auditor',
      auditStream: async function* () {
        yield '审稿';
        yield '结果';
      },
      audit: vi.fn().mockResolvedValue({
        id: 'test-review-id',
        chapterId: 1,
        overallScore: 7.5,
        scores: [],
        issues: [],
        summary: '测试报告',
        createdAt: new Date().toISOString(),
      }),
    })),
    createLLMClient: vi.fn().mockReturnValue({
      chatCompletion: vi.fn(),
      chatCompletionStream: vi.fn(),
    }),
  };
});

describe('Chat Routes', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-chat-test-'));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  function server() {
    return createServer(projectRoot).app;
  }

  it('POST /api/v1/chat/sessions — 创建会话', async () => {
    const app = server();
    const res = await app.request('/api/v1/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '测试对话' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('测试对话');
    expect(body.id).toBeDefined();
    expect(body.messages).toEqual([]);
  });

  it('POST /api/v1/chat/sessions — 创建绑定章节的会话', async () => {
    const app = server();
    const res = await app.request('/api/v1/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId: 1, title: '章节1对话' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.chapterId).toBe(1);
  });

  it('GET /api/v1/chat/sessions — 列出会话', async () => {
    const app = server();
    await app.request('/api/v1/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await app.request('/api/v1/chat/sessions');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  it('GET /api/v1/chat/sessions/:id — 获取会话详情', async () => {
    const app = server();
    const createRes = await app.request('/api/v1/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const { id } = await createRes.json();
    const res = await app.request(`/api/v1/chat/sessions/${id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(id);
  });

  it('GET /api/v1/chat/sessions/:id — 不存在返回 404', async () => {
    const app = server();
    const res = await app.request('/api/v1/chat/sessions/nonexistent');
    expect(res.status).toBe(404);
  });

  it('DELETE /api/v1/chat/sessions/:id — 删除会话', async () => {
    const app = server();
    const createRes = await app.request('/api/v1/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const { id } = await createRes.json();
    const res = await app.request(`/api/v1/chat/sessions/${id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    // 确认已删除
    const getRes = await app.request(`/api/v1/chat/sessions/${id}`);
    expect(getRes.status).toBe(404);
  });

  it('POST /api/v1/chat/sessions/:id/messages — 发送消息', async () => {
    const app = server();
    const createRes = await app.request('/api/v1/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const { id } = await createRes.json();
    const res = await app.request(`/api/v1/chat/sessions/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '续写一段场景' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    // 等待异步 AI 回复完成（入队执行）
    await new Promise((r) => setTimeout(r, 100));

    // 验证消息已追加到会话
    const sessionRes = await app.request(`/api/v1/chat/sessions/${id}`);
    const session = await sessionRes.json();
    expect(session.messages.length).toBeGreaterThanOrEqual(2);
    expect(session.messages[0].role).toBe('user');
    expect(session.messages[0].content).toBe('续写一段场景');
    expect(session.messages[1].role).toBe('assistant');
  });

  it('POST /api/v1/chat/sessions/:id/messages — 不存在的会话返回 404', async () => {
    const app = server();
    const res = await app.request('/api/v1/chat/sessions/nonexistent/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '测试' }),
    });
    expect(res.status).toBe(404);
  });

  it('POST /api/v1/chat/sessions/:id/messages — 空消息返回 400', async () => {
    const app = server();
    const createRes = await app.request('/api/v1/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const { id } = await createRes.json();
    const res = await app.request(`/api/v1/chat/sessions/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/chat/sessions/:id/messages — brainstormer 路由', async () => {
    vi.mocked(routeUserMessage).mockResolvedValueOnce('brainstormer');
    const app = server();
    const createRes = await app.request('/api/v1/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const { id } = await createRes.json();
    const res = await app.request(`/api/v1/chat/sessions/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '构思一个修仙设定' }),
    });
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 100));

    const sessionRes = await app.request(`/api/v1/chat/sessions/${id}`);
    const session = await sessionRes.json();
    expect(session.messages[1].role).toBe('assistant');
    expect(session.messages[1].agent).toBe('brainstormer');
  });

  it('POST /api/v1/chat/sessions/:id/messages — auditor 路由', async () => {
    vi.mocked(routeUserMessage).mockResolvedValueOnce('auditor');
    const app = server();
    const createRes = await app.request('/api/v1/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const { id } = await createRes.json();
    const res = await app.request(`/api/v1/chat/sessions/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '审稿这段内容' }),
    });
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 100));

    const sessionRes = await app.request(`/api/v1/chat/sessions/${id}`);
    const session = await sessionRes.json();
    expect(session.messages[1].role).toBe('assistant');
    expect(session.messages[1].agent).toBe('auditor');
  });

  it('POST /api/v1/chat/sessions/:id/messages — agentOverride 覆盖路由', async () => {
    const app = server();
    const createRes = await app.request('/api/v1/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const { id } = await createRes.json();
    const res = await app.request(`/api/v1/chat/sessions/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test', context: { agentOverride: 'brainstormer' } }),
    });
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 100));

    const sessionRes = await app.request(`/api/v1/chat/sessions/${id}`);
    const session = await sessionRes.json();
    expect(session.messages[1].agent).toBe('brainstormer');
  });
});
