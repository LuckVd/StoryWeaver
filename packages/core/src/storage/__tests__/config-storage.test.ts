import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigStorage } from '../config-storage.js';
import type { ModelConfig } from '../../models/config.js';

describe('ConfigStorage', () => {
  let root: string;
  let storage: ConfigStorage;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'sw-config-'));
    storage = new ConfigStorage(root);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const m = (id: string): ModelConfig => ({
    id,
    name: id,
    service: 'openai',
    apiKey: 'sk-x',
    baseUrl: 'http://x',
  });

  it('空时返回 []', async () => {
    expect(await storage.listModels()).toEqual([]);
  });

  it('upsert 新增 + 按 id 更新', async () => {
    await storage.upsertModel(m('a'));
    await storage.upsertModel(m('b'));
    expect((await storage.listModels()).map((x) => x.id)).toEqual(['a', 'b']);
    await storage.upsertModel({ ...m('a'), name: 'A2' });
    const list = await storage.listModels();
    expect(list.find((x) => x.id === 'a')?.name).toBe('A2');
    expect(list.length).toBe(2);
  });

  it('delete 移除指定 id', async () => {
    await storage.upsertModel(m('a'));
    await storage.upsertModel(m('b'));
    await storage.deleteModel('a');
    expect((await storage.listModels()).map((x) => x.id)).toEqual(['b']);
  });

  it('持久化(新实例可读)', async () => {
    await storage.upsertModel(m('a'));
    const s2 = new ConfigStorage(root);
    expect((await s2.listModels()).length).toBe(1);
  });
});

describe('ConfigStorage assignment (G05-S03)', () => {
  let root: string;
  let storage: ConfigStorage;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'sw-cfg-a-'));
    storage = new ConfigStorage(root);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('默认 assignment { default: "" }', async () => {
    expect(await storage.getAssignment()).toEqual({ default: '' });
  });

  it('set/get assignment', async () => {
    await storage.setAssignment({ default: 'gpt4', overrides: { writer: 'claude' } });
    const a = await storage.getAssignment();
    expect(a.default).toBe('gpt4');
    expect(a.overrides?.writer).toBe('claude');
  });

  it('saveModels / upsertModel 保留 assignment', async () => {
    await storage.setAssignment({ default: 'gpt4' });
    await storage.upsertModel({ id: 'gpt4', name: 'GPT4', service: 'openai', apiKey: 'sk' });
    expect((await storage.getAssignment()).default).toBe('gpt4');
    expect((await storage.listModels()).length).toBe(1);
  });
});
