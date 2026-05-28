import { KnowledgeStorage, OutlineStorage, RelationStorage } from '@storyweaver/core';
import type {
  Character,
  WorldEntry,
  WorldSubCategory,
  Item,
  Hook,
  Rule,
  CustomKnowledge,
  OutlineNode,
  RelationEdge,
} from '@storyweaver/core';

/**
 * 知识库业务逻辑层
 *
 * 封装 KnowledgeStorage / OutlineStorage / RelationStorage，
 * 提供统一的知识库 CRUD 接口。
 */
export class KnowledgeService {
  constructor(
    private readonly knowledgeStorage: KnowledgeStorage,
    private readonly outlineStorage: OutlineStorage,
    private readonly relationStorage: RelationStorage,
  ) {}

  // ── 概览 ──

  async overview(): Promise<{ categories: Record<string, number>; customCategories: string[] }> {
    const characters = await this.knowledgeStorage.listCharacters();
    const items = await this.knowledgeStorage.listSimple<Item>('items');
    const hooks = await this.knowledgeStorage.listSimple<Hook>('hooks');
    const rules = await this.knowledgeStorage.listSimple<Rule>('rules');
    const customCategories = await this.knowledgeStorage.listCustomCategories();

    const worldCounts: Record<string, number> = {};
    for (const sub of ['geography', 'power-system', 'factions', 'history', 'glossary'] as WorldSubCategory[]) {
      const entries = await this.knowledgeStorage.listWorld(sub);
      worldCounts[sub] = entries.length;
    }

    return {
      categories: {
        characters: characters.length,
        world: Object.values(worldCounts).reduce((a, b) => a + b, 0),
        items: items.length,
        hooks: hooks.length,
        rules: rules.length,
        ...worldCounts,
      },
      customCategories,
    };
  }

  // ── Characters ──

  async listCharacters(): Promise<Character[]> {
    return this.knowledgeStorage.listCharacters();
  }

  async getCharacter(id: string): Promise<Character | null> {
    return this.knowledgeStorage.getCharacter(id);
  }

  async createCharacter(data: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>): Promise<Character> {
    return this.knowledgeStorage.createCharacter(data);
  }

  async updateCharacter(id: string, patch: Partial<Omit<Character, 'id' | 'createdAt'>>): Promise<Character | null> {
    return this.knowledgeStorage.updateCharacter(id, patch);
  }

  async deleteCharacter(id: string): Promise<boolean> {
    return this.knowledgeStorage.deleteCharacter(id);
  }

  // ── World ──

  async listWorld(sub: WorldSubCategory): Promise<WorldEntry[]> {
    return this.knowledgeStorage.listWorld(sub);
  }

  async createWorld(sub: WorldSubCategory, data: Omit<WorldEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorldEntry> {
    return this.knowledgeStorage.createWorld(sub, data);
  }

  async updateWorld(sub: WorldSubCategory, id: string, patch: Partial<Omit<WorldEntry, 'id' | 'createdAt'>>): Promise<WorldEntry | null> {
    return this.knowledgeStorage.updateWorld(sub, id, patch);
  }

  async deleteWorld(sub: WorldSubCategory, id: string): Promise<boolean> {
    return this.knowledgeStorage.deleteWorld(sub, id);
  }

  // ── Items ──

  async listItems(): Promise<Item[]> {
    return this.knowledgeStorage.listSimple<Item>('items');
  }

  async createItem(data: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Promise<Item> {
    return this.knowledgeStorage.createSimple<Item>('items', data);
  }

  async updateItem(id: string, patch: Partial<Omit<Item, 'id' | 'createdAt'>>): Promise<Item | null> {
    return this.knowledgeStorage.updateSimple<Item>('items', id, patch);
  }

  async deleteItem(id: string): Promise<boolean> {
    return this.knowledgeStorage.deleteSimple('items', id);
  }

  // ── Hooks ──

  async listHooks(): Promise<Hook[]> {
    return this.knowledgeStorage.listSimple<Hook>('hooks');
  }

  async createHook(data: Omit<Hook, 'id' | 'createdAt' | 'updatedAt'>): Promise<Hook> {
    return this.knowledgeStorage.createSimple<Hook>('hooks', data);
  }

  async updateHook(id: string, patch: Partial<Omit<Hook, 'id' | 'createdAt'>>): Promise<Hook | null> {
    return this.knowledgeStorage.updateSimple<Hook>('hooks', id, patch);
  }

  async deleteHook(id: string): Promise<boolean> {
    return this.knowledgeStorage.deleteSimple('hooks', id);
  }

  // ── Rules ──

  async listRules(): Promise<Rule[]> {
    return this.knowledgeStorage.listSimple<Rule>('rules');
  }

  async createRule(data: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rule> {
    return this.knowledgeStorage.createSimple<Rule>('rules', data);
  }

  async updateRule(id: string, patch: Partial<Omit<Rule, 'id' | 'createdAt'>>): Promise<Rule | null> {
    return this.knowledgeStorage.updateSimple<Rule>('rules', id, patch);
  }

  async deleteRule(id: string): Promise<boolean> {
    return this.knowledgeStorage.deleteSimple('rules', id);
  }

  // ── Custom ──

  async listCustom(categoryName: string): Promise<CustomKnowledge[]> {
    return this.knowledgeStorage.listCustom(categoryName);
  }

  async createCustom(categoryName: string, data: Omit<CustomKnowledge, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomKnowledge> {
    return this.knowledgeStorage.createCustom(categoryName, data);
  }

  async updateCustom(categoryName: string, id: string, patch: Partial<Omit<CustomKnowledge, 'id' | 'createdAt'>>): Promise<CustomKnowledge | null> {
    return this.knowledgeStorage.updateCustom(categoryName, id, patch);
  }

  async deleteCustom(categoryName: string, id: string): Promise<boolean> {
    return this.knowledgeStorage.deleteCustom(categoryName, id);
  }

  async listCustomCategories(): Promise<string[]> {
    return this.knowledgeStorage.listCustomCategories();
  }

  // ── Outline ──

  async getOutline(): Promise<OutlineNode | null> {
    return this.outlineStorage.read();
  }

  async updateOutline(tree: OutlineNode): Promise<OutlineNode> {
    await this.outlineStorage.write(tree);
    return tree;
  }

  // ── Relations ──

  async listRelations(): Promise<RelationEdge[]> {
    return this.relationStorage.list();
  }

  async createRelation(data: Omit<RelationEdge, 'id'>): Promise<RelationEdge> {
    return this.relationStorage.create(data);
  }

  async updateRelation(id: string, patch: Partial<Omit<RelationEdge, 'id'>>): Promise<RelationEdge | null> {
    return this.relationStorage.update(id, patch);
  }

  async deleteRelation(id: string): Promise<boolean> {
    return this.relationStorage.delete(id);
  }
}
