import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KnowledgeStorage } from '../knowledge-storage.js';
import type { Character, WorldEntry, Item, Hook, Rule, CustomKnowledge } from '../../models/index.js';

describe('KnowledgeStorage', () => {
  let projectRoot: string;
  let storage: KnowledgeStorage;

  beforeAll(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-knowledge-test-'));
    storage = new KnowledgeStorage(projectRoot);
  });

  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  // ── Characters ──

  describe('characters', () => {
    const baseChar = {
      name: '张三',
      description: '主角',
      aliases: ['小张'],
      firstAppearance: 1,
      tags: ['主角'],
    };

    it('should list empty when no characters', async () => {
      const list = await storage.listCharacters();
      expect(list).toEqual([]);
    });

    it('should create a character', async () => {
      const char = await storage.createCharacter(baseChar);
      expect(char.id).toBeDefined();
      expect(char.name).toBe('张三');
      expect(char.aliases).toEqual(['小张']);
      expect(char.createdAt).toBeDefined();
    });

    it('should list created characters', async () => {
      const list = await storage.listCharacters();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('张三');
    });

    it('should get character by id', async () => {
      const list = await storage.listCharacters();
      const char = await storage.getCharacter(list[0].id);
      expect(char).not.toBeNull();
      expect(char!.name).toBe('张三');
      expect(char!.profile).toBeUndefined();
    });

    it('should update character', async () => {
      const list = await storage.listCharacters();
      const updated = await storage.updateCharacter(list[0].id, { description: '修仙者', profile: '金丹期修士' });
      expect(updated).not.toBeNull();
      expect(updated!.description).toBe('修仙者');
      expect(updated!.profile).toBe('金丹期修士');
    });

    it('should delete character', async () => {
      const list = await storage.listCharacters();
      const deleted = await storage.deleteCharacter(list[0].id);
      expect(deleted).toBe(true);
      expect(await storage.listCharacters()).toHaveLength(0);
    });

    it('should return false deleting non-existent character', async () => {
      const deleted = await storage.deleteCharacter('non-existent');
      expect(deleted).toBe(false);
    });

    it('should return null getting non-existent character', async () => {
      const char = await storage.getCharacter('non-existent');
      expect(char).toBeNull();
    });
  });

  // ── World ──

  describe('world', () => {
    it('should create and list world entries', async () => {
      const entry = await storage.createWorld('geography', {
        category: 'geography',
        name: '天都山',
        content: '主角修炼之地',
        tags: ['地点'],
      });
      expect(entry.id).toBeDefined();
      expect(entry.name).toBe('天都山');

      const list = await storage.listWorld('geography');
      expect(list).toHaveLength(1);
    });

    it('should update world entry', async () => {
      const list = await storage.listWorld('geography');
      const updated = await storage.updateWorld('geography', list[0].id, { content: '灵气充沛的名山' });
      expect(updated!.content).toBe('灵气充沛的名山');
    });

    it('should delete world entry', async () => {
      const list = await storage.listWorld('geography');
      expect(await storage.deleteWorld('geography', list[0].id)).toBe(true);
      expect(await storage.listWorld('geography')).toHaveLength(0);
    });

    it('should separate world sub-categories', async () => {
      await storage.createWorld('geography', { category: 'geography', name: '地点A', content: 'A' });
      await storage.createWorld('power-system', { category: 'power-system', name: '修仙体系', content: '练气到飞升' });

      expect(await storage.listWorld('geography')).toHaveLength(1);
      expect(await storage.listWorld('power-system')).toHaveLength(1);
    });
  });

  // ── Items ──

  describe('items', () => {
    it('should CRUD items', async () => {
      const item = await storage.createSimple<Item>('items', {
        name: '紫霄剑',
        description: '上古神剑',
        owner: 'char-1',
        tags: ['武器'],
      });
      expect(item.id).toBeDefined();

      const got = await storage.getSimple<Item>('items', item.id);
      expect(got!.name).toBe('紫霄剑');

      const updated = await storage.updateSimple<Item>('items', item.id, { description: '改了' });
      expect(updated!.description).toBe('改了');

      expect(await storage.deleteSimple('items', item.id)).toBe(true);
      expect(await storage.listSimple<Item>('items')).toHaveLength(0);
    });
  });

  // ── Hooks ──

  describe('hooks', () => {
    it('should CRUD hooks', async () => {
      const hook = await storage.createSimple<Hook>('hooks', {
        name: '神秘戒指',
        description: '主角捡到的戒指',
        status: 'active',
        plantedAt: 1,
        relatedEntities: ['char-1'],
      });
      expect(hook.id).toBeDefined();
      expect(hook.status).toBe('active');

      const updated = await storage.updateSimple<Hook>('hooks', hook.id, { status: 'resolved', resolvedAt: 10 });
      expect(updated!.status).toBe('resolved');
      expect(updated!.resolvedAt).toBe(10);

      expect(await storage.deleteSimple('hooks', hook.id)).toBe(true);
    });
  });

  // ── Rules ──

  describe('rules', () => {
    it('should CRUD rules', async () => {
      const rule = await storage.createSimple<Rule>('rules', {
        category: 'style',
        name: '禁止现代用语',
        content: '不能出现 "OK" 等现代词汇',
        priority: 'high',
      });
      expect(rule.id).toBeDefined();

      const list = await storage.listSimple<Rule>('rules');
      expect(list).toHaveLength(1);

      expect(await storage.deleteSimple('rules', rule.id)).toBe(true);
    });
  });

  // ── Custom ──

  describe('custom', () => {
    it('should CRUD custom knowledge', async () => {
      const entry = await storage.createCustom('factions', {
        category: 'factions',
        name: '天机阁',
        content: '情报组织',
        tags: ['势力'],
      });
      expect(entry.id).toBeDefined();

      const list = await storage.listCustom('factions');
      expect(list).toHaveLength(1);

      const updated = await storage.updateCustom('factions', entry.id, { content: '神秘情报组织' });
      expect(updated!.content).toBe('神秘情报组织');

      expect(await storage.deleteCustom('factions', entry.id)).toBe(true);
    });

    it('should list custom categories', async () => {
      await storage.createCustom('factions', { category: 'factions', name: 'A', content: 'A' });
      await storage.createCustom('techniques', { category: 'techniques', name: 'B', content: 'B' });

      const cats = await storage.listCustomCategories();
      expect(cats).toContain('factions');
      expect(cats).toContain('techniques');
    });
  });
});
