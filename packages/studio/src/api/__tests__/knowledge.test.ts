import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../server.js';

describe('Knowledge API', () => {
  let projectRoot: string;
  let app: ReturnType<typeof createServer>['app'];

  beforeAll(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-knowledge-api-'));
    const server = createServer(projectRoot);
    app = server.app;
  });

  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  // ── Overview ──

  describe('GET /api/v1/knowledge', () => {
    it('should return overview with empty categories', async () => {
      const res = await app.request('/api/v1/knowledge');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.categories).toBeDefined();
      expect(body.customCategories).toEqual([]);
    });
  });

  // ── Characters ──

  describe('Characters CRUD', () => {
    let characterId: string;

    it('should create a character', async () => {
      const res = await app.request('/api/v1/knowledge/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '张三', description: '主角', aliases: ['小张'], tags: ['主角'] }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe('张三');
      expect(body.id).toBeDefined();
      characterId = body.id;
    });

    it('should list characters', async () => {
      const res = await app.request('/api/v1/knowledge/characters');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe('张三');
    });

    it('should get character by id', async () => {
      const res = await app.request(`/api/v1/knowledge/characters/${characterId}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('张三');
    });

    it('should update character', async () => {
      const res = await app.request(`/api/v1/knowledge/characters/${characterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: '修仙者' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.description).toBe('修仙者');
    });

    it('should return 404 for non-existent character', async () => {
      const res = await app.request('/api/v1/knowledge/characters/non-existent');
      expect(res.status).toBe(404);
    });

    it('should delete character', async () => {
      const res = await app.request(`/api/v1/knowledge/characters/${characterId}`, { method: 'DELETE' });
      expect(res.status).toBe(200);
    });

    it('should validate create input', async () => {
      const res = await app.request('/api/v1/knowledge/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: '缺少名称' }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ── World ──

  describe('World CRUD', () => {
    let entryId: string;

    it('should create world entry', async () => {
      const res = await app.request('/api/v1/knowledge/world', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'geography', name: '天都山', content: '灵山' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      entryId = body.id;
    });

    it('should list world entries by sub', async () => {
      const res = await app.request('/api/v1/knowledge/world?sub=geography');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
    });

    it('should list all world entries', async () => {
      const res = await app.request('/api/v1/knowledge/world');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.geography).toBeDefined();
    });

    it('should update world entry', async () => {
      const res = await app.request(`/api/v1/knowledge/world/${entryId}?sub=geography`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '灵气充沛' }),
      });
      expect(res.status).toBe(200);
    });

    it('should delete world entry', async () => {
      const res = await app.request(`/api/v1/knowledge/world/${entryId}?sub=geography`, { method: 'DELETE' });
      expect(res.status).toBe(200);
    });

    it('should require sub param for update', async () => {
      const res = await app.request(`/api/v1/knowledge/world/some-id`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test' }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ── Items ──

  describe('Items CRUD', () => {
    let itemId: string;

    it('should create item', async () => {
      const res = await app.request('/api/v1/knowledge/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '紫霄剑', description: '神剑' }),
      });
      expect(res.status).toBe(201);
      itemId = (await res.json()).id;
    });

    it('should list items', async () => {
      const res = await app.request('/api/v1/knowledge/items');
      expect(res.status).toBe(200);
      expect((await res.json())).toHaveLength(1);
    });

    it('should update item', async () => {
      const res = await app.request(`/api/v1/knowledge/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: '上古神器' }),
      });
      expect(res.status).toBe(200);
    });

    it('should delete item', async () => {
      const res = await app.request(`/api/v1/knowledge/items/${itemId}`, { method: 'DELETE' });
      expect(res.status).toBe(200);
    });
  });

  // ── Hooks ──

  describe('Hooks CRUD', () => {
    it('should create and list hooks', async () => {
      const res = await app.request('/api/v1/knowledge/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '神秘戒指', description: '捡到的', status: 'active', plantedAt: 1 }),
      });
      expect(res.status).toBe(201);

      const list = await app.request('/api/v1/knowledge/hooks');
      expect((await list.json())).toHaveLength(1);
    });
  });

  // ── Rules ──

  describe('Rules CRUD', () => {
    it('should create and list rules', async () => {
      const res = await app.request('/api/v1/knowledge/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'style', name: '禁止现代用语', content: '不能出现OK', priority: 'high' }),
      });
      expect(res.status).toBe(201);

      const list = await app.request('/api/v1/knowledge/rules');
      expect((await list.json())).toHaveLength(1);
    });
  });

  // ── Custom ──

  describe('Custom CRUD', () => {
    let customId: string;

    it('should create custom entry', async () => {
      const res = await app.request('/api/v1/knowledge/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'factions', name: '天机阁', content: '情报组织' }),
      });
      expect(res.status).toBe(201);
      customId = (await res.json()).id;
    });

    it('should list custom entries', async () => {
      const res = await app.request('/api/v1/knowledge/custom?name=factions');
      expect(res.status).toBe(200);
      expect((await res.json())).toHaveLength(1);
    });

    it('should list custom categories', async () => {
      const res = await app.request('/api/v1/knowledge/custom');
      expect(res.status).toBe(200);
      const cats = await res.json();
      expect(cats).toContain('factions');
    });

    it('should update custom entry', async () => {
      const res = await app.request(`/api/v1/knowledge/custom/${customId}?name=factions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '神秘情报组织' }),
      });
      expect(res.status).toBe(200);
    });

    it('should delete custom entry', async () => {
      const res = await app.request(`/api/v1/knowledge/custom/${customId}?name=factions`, { method: 'DELETE' });
      expect(res.status).toBe(200);
    });
  });

  // ── Outline ──

  describe('Outline', () => {
    it('should return null when no outline', async () => {
      const res = await app.request('/api/v1/knowledge/outline');
      expect(res.status).toBe(200);
      expect(await res.json()).toBeNull();
    });

    it('should update and read outline', async () => {
      const tree = {
        id: 'root',
        type: 'book',
        title: '测试书',
        sortOrder: 0,
        children: [],
      };
      const putRes = await app.request('/api/v1/knowledge/outline', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tree),
      });
      expect(putRes.status).toBe(200);
      expect((await putRes.json()).title).toBe('测试书');

      const getRes = await app.request('/api/v1/knowledge/outline');
      expect((await getRes.json()).title).toBe('测试书');
    });
  });

  // ── Relations ──

  describe('Relations CRUD', () => {
    let relationId: string;

    it('should create relation', async () => {
      const res = await app.request('/api/v1/knowledge/relations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'a', to: 'b', type: '师徒', direction: 'directed' }),
      });
      expect(res.status).toBe(201);
      relationId = (await res.json()).id;
    });

    it('should list relations', async () => {
      const res = await app.request('/api/v1/knowledge/relations');
      expect(res.status).toBe(200);
      expect((await res.json())).toHaveLength(1);
    });

    it('should update relation', async () => {
      const res = await app.request(`/api/v1/knowledge/relations/${relationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: '师徒关系' }),
      });
      expect(res.status).toBe(200);
      expect((await res.json()).note).toBe('师徒关系');
    });

    it('should delete relation', async () => {
      const res = await app.request(`/api/v1/knowledge/relations/${relationId}`, { method: 'DELETE' });
      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent relation', async () => {
      const res = await app.request('/api/v1/knowledge/relations/non-existent', { method: 'DELETE' });
      expect(res.status).toBe(404);
    });
  });

  // ── AI 智能提取(无 LLM,仅测校验与降级;成功路径由 core/curator-agent 覆盖) ──

  describe('AI Extract', () => {
    let prevKey: string | undefined;

    beforeAll(() => {
      prevKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
    });

    afterAll(() => {
      if (prevKey !== undefined) process.env.OPENAI_API_KEY = prevKey;
    });

    it('空文本 → 400', async () => {
      const res = await app.request('/api/v1/knowledge/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '' }),
      });
      expect(res.status).toBe(400);
    });

    it('超长文本 → 400', async () => {
      const res = await app.request('/api/v1/knowledge/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'x'.repeat(20001) }),
      });
      expect(res.status).toBe(400);
    });

    it('未配置 AI → 502 降级', async () => {
      const res = await app.request('/api/v1/knowledge/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '一段设定文字' }),
      });
      expect(res.status).toBe(502);
    });
  });
});
