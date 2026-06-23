import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../server.js';

describe('prompts route (G05-S08)', () => {
  let projectRoot: string;
  let app: ReturnType<typeof createServer>['app'];

  beforeAll(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-prompts-'));
    app = createServer(projectRoot).app;
  });
  afterAll(() => rmSync(projectRoot, { recursive: true, force: true }));

  it('列出全部 prompt(默认未覆盖)', async () => {
    const res = await app.request('/api/v1/prompts');
    const data = await res.json();
    const names = data.prompts.map((p: { name: string }) => p.name);
    expect(names).toEqual(expect.arrayContaining(['writer', 'auditor', 'brainstormer', 'summarizer', 'curator']));
    expect(data.prompts.every((p: { overridden: boolean }) => p.overridden === false)).toBe(true);
  });

  it('读取 writer 默认 prompt', async () => {
    const res = await app.request('/api/v1/prompts/writer');
    const data = await res.json();
    expect(data.overridden).toBe(false);
    expect(data.content).toBe(data.defaultContent);
    expect(data.content).toContain('Writer');
  });

  it('PUT 覆盖 + GET 显示 overridden', async () => {
    await app.request('/api/v1/prompts/writer', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '自定义 writer prompt' }),
    });
    const data = await (await app.request('/api/v1/prompts/writer')).json();
    expect(data.overridden).toBe(true);
    expect(data.content).toBe('自定义 writer prompt');
  });

  it('DELETE 恢复默认', async () => {
    await app.request('/api/v1/prompts/writer', { method: 'DELETE' });
    const data = await (await app.request('/api/v1/prompts/writer')).json();
    expect(data.overridden).toBe(false);
    expect(data.content).toBe(data.defaultContent);
  });

  it('未知 prompt 返回 404', async () => {
    const res = await app.request('/api/v1/prompts/nope');
    expect(res.status).toBe(404);
  });
});
