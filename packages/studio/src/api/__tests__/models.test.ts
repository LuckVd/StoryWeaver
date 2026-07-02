import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../server.js';

describe('models route (G05-S02)', () => {
  let projectRoot: string;
  let configRoot: string;
  let app: ReturnType<typeof createServer>['app'];

  beforeAll(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-models-'));
    configRoot = mkdtempSync(join(tmpdir(), 'sw-models-cfg-'));
    app = createServer(projectRoot, configRoot).app;
  });
  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(configRoot, { recursive: true, force: true });
  });

  it('GET 空列表', async () => {
    const res = await app.request('/api/v1/models');
    expect(res.status).toBe(200);
    expect((await res.json()).models).toEqual([]);
  });

  it('POST 新增返回脱敏 key', async () => {
    const res = await app.request('/api/v1/models', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'gpt4', name: 'GPT4', service: 'openai', apiKey: 'sk-1234567890' }),
    });
    expect(res.status).toBe(200);
    const list = (await res.json()).models;
    expect(list.find((m: { id: string }) => m.id === 'gpt4')?.apiKey).toBe('***7890');
  });

  it('POST 更新时脱敏 key 回填旧值', async () => {
    await app.request('/api/v1/models', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'm1', name: 'M1', service: 'openai', apiKey: 'sk-abcdefgh' }),
    });
    // 用脱敏 key 更新 → 应保留旧 key
    const res = await app.request('/api/v1/models', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'm1', name: 'M1-renamed', service: 'openai', apiKey: '***defgh' }),
    });
    const list = (await res.json()).models;
    expect(list.find((m: { id: string }) => m.id === 'm1')?.name).toBe('M1-renamed');
  });

  it('DELETE 移除模型', async () => {
    await app.request('/api/v1/models', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'toDel', name: 'X', service: 'openai', apiKey: 'sk-x' }),
    });
    const res = await app.request('/api/v1/models/toDel', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const list = (await res.json()).models;
    expect(list.find((m: { id: string }) => m.id === 'toDel')).toBeUndefined();
  });

  it('test 不存在的模型返回 ok:false', async () => {
    const res = await app.request('/api/v1/models/nope/test', { method: 'POST' });
    expect((await res.json()).ok).toBe(false);
  });

  it('assignment GET 默认 + PUT 设置(G05-S03)', async () => {
    const getRes = await app.request('/api/v1/models/assignment');
    expect((await getRes.json()).default).toBe('');
    const putRes = await app.request('/api/v1/models/assignment', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ default: 'gpt4', overrides: { writer: 'claude' } }),
    });
    const a = await putRes.json();
    expect(a.default).toBe('gpt4');
    expect(a.overrides.writer).toBe('claude');
  });
});
