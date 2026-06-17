import { create } from 'zustand';
import { api } from '@/lib/api-client';
import type {
  Character,
  WorldEntry,
  Item,
  Hook,
  Rule,
  CustomKnowledge,
  RelationEdge,
} from '@storyweaver/core';

/** 图节点中的实体（统一最小结构） */
export interface GraphEntity {
  id: string;
  name: string;
  type: 'character' | 'world' | 'item' | 'hook' | 'rule';
}

interface KnowledgeState {
  // 实体数据
  characters: Character[];
  worldEntries: WorldEntry[];
  items: Item[];
  hooks: Hook[];
  rules: Rule[];
  customCategories: string[];
  customEntries: Record<string, CustomKnowledge[]>;
  entities: GraphEntity[];
  relations: RelationEdge[];

  // 加载标记（每种实体独立）
  loaded: Record<string, boolean>;
  loading: boolean;
  error: string | null;

  // 通用 fetch
  fetchCharacters: () => Promise<void>;
  fetchWorld: () => Promise<void>;
  fetchItems: () => Promise<void>;
  fetchHooks: () => Promise<void>;
  fetchRules: () => Promise<void>;
  fetchCustomCategories: () => Promise<void>;
  fetchCustom: (category: string) => Promise<void>;
  fetchAll: () => Promise<void>;

  // Characters CRUD
  createCharacter: (data: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateCharacter: (id: string, data: Partial<Omit<Character, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;

  // World CRUD
  createWorld: (data: { category: string; name: string; content: string; tags?: string[] }) => Promise<void>;
  updateWorld: (sub: string, id: string, data: Partial<{ name: string; content: string; tags?: string[] }>) => Promise<void>;
  deleteWorld: (sub: string, id: string) => Promise<void>;

  // Items CRUD
  createItem: (data: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateItem: (id: string, data: Partial<Omit<Item, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;

  // Hooks CRUD
  createHook: (data: Omit<Hook, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateHook: (id: string, data: Partial<Omit<Hook, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteHook: (id: string) => Promise<void>;

  // Rules CRUD
  createRule: (data: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateRule: (id: string, data: Partial<Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;

  // Custom CRUD
  createCustom: (data: { category: string; name: string; content: string; tags?: string[] }) => Promise<void>;
  updateCustom: (category: string, id: string, data: Partial<{ name: string; content: string; tags?: string[] }>) => Promise<void>;
  deleteCustom: (category: string, id: string) => Promise<void>;

  // Relations
  addRelation: (data: Omit<RelationEdge, 'id'>) => Promise<void>;
  removeRelation: (id: string) => Promise<void>;
}

/** 从各实体类型提取统一结构 */
function toEntities(
  characters: Character[],
  world: WorldEntry[],
  items: Item[],
  hooks: Hook[],
  rules: Rule[],
): GraphEntity[] {
  return [
    ...characters.map((c) => ({ id: c.id, name: c.name, type: 'character' as const })),
    ...world.map((w) => ({ id: w.id, name: w.name, type: 'world' as const })),
    ...items.map((i) => ({ id: i.id, name: i.name, type: 'item' as const })),
    ...hooks.map((h) => ({ id: h.id, name: h.name, type: 'hook' as const })),
    ...rules.map((r) => ({ id: r.id, name: r.name, type: 'rule' as const })),
  ];
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  characters: [],
  worldEntries: [],
  items: [],
  hooks: [],
  rules: [],
  customCategories: [],
  customEntries: {},
  entities: [],
  relations: [],
  loaded: {},
  loading: false,
  error: null,

  // --- Fetch ---

  fetchCharacters: async () => {
    if (get().loaded.characters) return;
    try {
      const characters = await api.get<Character[]>('/knowledge/characters');
      set({ characters, loaded: { ...get().loaded, characters: true } });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  },

  fetchWorld: async () => {
    if (get().loaded.world) return;
    try {
      const raw = await api.get<Record<string, WorldEntry[]>>('/knowledge/world');
      // API 返回 { geography: [...], 'power-system': [...], ... }，展开为平铺数组
      const worldEntries = Object.values(raw).flat();
      set({ worldEntries, loaded: { ...get().loaded, world: true } });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  },

  fetchItems: async () => {
    if (get().loaded.items) return;
    try {
      const items = await api.get<Item[]>('/knowledge/items');
      set({ items, loaded: { ...get().loaded, items: true } });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  },

  fetchHooks: async () => {
    if (get().loaded.hooks) return;
    try {
      const hooks = await api.get<Hook[]>('/knowledge/hooks');
      set({ hooks, loaded: { ...get().loaded, hooks: true } });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  },

  fetchRules: async () => {
    if (get().loaded.rules) return;
    try {
      const rules = await api.get<Rule[]>('/knowledge/rules');
      set({ rules, loaded: { ...get().loaded, rules: true } });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  },

  fetchCustomCategories: async () => {
    try {
      const cats = await api.get<string[]>('/knowledge/custom');
      set({ customCategories: cats });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  },

  fetchCustom: async (category: string) => {
    try {
      const entries = await api.get<CustomKnowledge[]>(`/knowledge/custom?name=${encodeURIComponent(category)}`);
      set({ customEntries: { ...get().customEntries, [category]: entries } });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  },

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [characters, worldRaw, items, hooks, rules, relations] = await Promise.all([
        api.get<Character[]>('/knowledge/characters'),
        api.get<Record<string, WorldEntry[]>>('/knowledge/world'),
        api.get<Item[]>('/knowledge/items'),
        api.get<Hook[]>('/knowledge/hooks'),
        api.get<Rule[]>('/knowledge/rules'),
        api.get<RelationEdge[]>('/knowledge/relations'),
      ]);
      // /knowledge/world 返回按子分类分组的对象，展开为平铺数组（与 fetchWorld 一致）
      const worldEntries = Object.values(worldRaw).flat();
      set({
        characters,
        worldEntries,
        items,
        hooks,
        rules,
        entities: toEntities(characters, worldEntries, items, hooks, rules),
        relations,
        loaded: { characters: true, world: true, items: true, hooks: true, rules: true },
        loading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  // --- Characters CRUD ---

  createCharacter: async (data) => {
    const char = await api.post<Character>('/knowledge/characters', data);
    set({ characters: [...get().characters, char] });
  },

  updateCharacter: async (id, data) => {
    const updated = await api.put<Character>(`/knowledge/characters/${id}`, data);
    set({ characters: get().characters.map((c) => (c.id === id ? updated : c)) });
  },

  deleteCharacter: async (id) => {
    await api.del(`/knowledge/characters/${id}`);
    set({ characters: get().characters.filter((c) => c.id !== id) });
  },

  // --- World CRUD ---

  createWorld: async (data) => {
    const entry = await api.post<WorldEntry>('/knowledge/world', data);
    set({ worldEntries: [...get().worldEntries, entry] });
  },

  updateWorld: async (sub, id, data) => {
    const updated = await api.put<WorldEntry>(`/knowledge/world/${id}?sub=${sub}`, data);
    set({ worldEntries: get().worldEntries.map((w) => (w.id === id ? updated : w)) });
  },

  deleteWorld: async (sub, id) => {
    await api.del(`/knowledge/world/${id}?sub=${sub}`);
    set({ worldEntries: get().worldEntries.filter((w) => w.id !== id) });
  },

  // --- Items CRUD ---

  createItem: async (data) => {
    const item = await api.post<Item>('/knowledge/items', data);
    set({ items: [...get().items, item] });
  },

  updateItem: async (id, data) => {
    const updated = await api.put<Item>(`/knowledge/items/${id}`, data);
    set({ items: get().items.map((i) => (i.id === id ? updated : i)) });
  },

  deleteItem: async (id) => {
    await api.del(`/knowledge/items/${id}`);
    set({ items: get().items.filter((i) => i.id !== id) });
  },

  // --- Hooks CRUD ---

  createHook: async (data) => {
    const hook = await api.post<Hook>('/knowledge/hooks', data);
    set({ hooks: [...get().hooks, hook] });
  },

  updateHook: async (id, data) => {
    const updated = await api.put<Hook>(`/knowledge/hooks/${id}`, data);
    set({ hooks: get().hooks.map((h) => (h.id === id ? updated : h)) });
  },

  deleteHook: async (id) => {
    await api.del(`/knowledge/hooks/${id}`);
    set({ hooks: get().hooks.filter((h) => h.id !== id) });
  },

  // --- Rules CRUD ---

  createRule: async (data) => {
    const rule = await api.post<Rule>('/knowledge/rules', data);
    set({ rules: [...get().rules, rule] });
  },

  updateRule: async (id, data) => {
    const updated = await api.put<Rule>(`/knowledge/rules/${id}`, data);
    set({ rules: get().rules.map((r) => (r.id === id ? updated : r)) });
  },

  deleteRule: async (id) => {
    await api.del(`/knowledge/rules/${id}`);
    set({ rules: get().rules.filter((r) => r.id !== id) });
  },

  // --- Custom CRUD ---

  createCustom: async (data) => {
    const entry = await api.post<CustomKnowledge>('/knowledge/custom', data);
    const { customEntries } = get();
    const list = customEntries[data.category] ?? [];
    set({ customEntries: { ...customEntries, [data.category]: [...list, entry] } });
  },

  updateCustom: async (category, id, data) => {
    const updated = await api.put<CustomKnowledge>(`/knowledge/custom/${id}?name=${encodeURIComponent(category)}`, data);
    const { customEntries } = get();
    const list = customEntries[category] ?? [];
    set({ customEntries: { ...customEntries, [category]: list.map((e) => (e.id === id ? updated : e)) } });
  },

  deleteCustom: async (category, id) => {
    await api.del(`/knowledge/custom/${id}?name=${encodeURIComponent(category)}`);
    const { customEntries } = get();
    const list = customEntries[category] ?? [];
    set({ customEntries: { ...customEntries, [category]: list.filter((e) => e.id !== id) } });
  },

  // --- Relations ---

  addRelation: async (data) => {
    try {
      const created = await api.post<RelationEdge>('/knowledge/relations', data);
      set({ relations: [...get().relations, created] });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  },

  removeRelation: async (id) => {
    try {
      await api.del(`/knowledge/relations/${id}`);
      set({ relations: get().relations.filter((r) => r.id !== id) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  },
}));
