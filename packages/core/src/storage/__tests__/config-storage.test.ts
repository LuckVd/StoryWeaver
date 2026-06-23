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
    storage = new ConfigStorage();
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
    expect(await storage.listModels(root)).toEqual([]);
  });

  it('upsert 新增 + 按 id 更新', async () => {
    await storage.upsertModel(root, m('a'));
    await storage.upsertModel(root, m('b'));
    expect((await storage.listModels(root)).map((x) => x.id)).toEqual(['a', 'b']);
    await storage.upsertModel(root, { ...m('a'), name: 'A2' });
    const list = await storage.listModels(root);
    expect(list.find((x) => x.id === 'a')?.name).toBe('A2');
    expect(list.length).toBe(2);
  });

  it('delete 移除指定 id', async () => {
    await storage.upsertModel(root, m('a'));
    await storage.upsertModel(root, m('b'));
    await storage.deleteModel(root, 'a');
    expect((await storage.listModels(root)).map((x) => x.id)).toEqual(['b']);
  });

  it('持久化(新实例可读)', async () => {
    await storage.upsertModel(root, m('a'));
    const s2 = new ConfigStorage();
    expect((await s2.listModels(root)).length).toBe(1);
  });
});

describe('ConfigStorage assignment (G05-S03)', () => {
  let root: string;
  let storage: ConfigStorage;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'sw-cfg-a-'));
    storage = new ConfigStorage();
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('默认 assignment { default: "" }', async () => {
    expect(await storage.getAssignment(root)).toEqual({ default: '' });
  });

  it('set/get assignment', async () => {
    await storage.setAssignment(root, { default: 'gpt4', overrides: { writer: 'claude' } });
    const a = await storage.getAssignment(root);
    expect(a.default).toBe('gpt4');
    expect(a.overrides?.writer).toBe('claude');
  });

  it('saveModels / upsertModel 保留 assignment', async () => {
    await storage.setAssignment(root, { default: 'gpt4' });
    await storage.upsertModel(root, { id: 'gpt4', name: 'GPT4', service: 'openai', apiKey: 'sk' });
    expect((await storage.getAssignment(root)).default).toBe('gpt4');
    expect((await storage.listModels(root)).length).toBe(1);
  });
});
