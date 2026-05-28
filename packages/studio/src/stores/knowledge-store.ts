import { create } from 'zustand';
import { api } from '@/lib/api-client';
import type {
  Character,
  WorldEntry,
  Item,
  Hook,
  Rule,
  RelationEdge,
} from '@storyweaver/core';

/** 图节点中的实体（统一最小结构） */
export interface GraphEntity {
  id: string;
  name: string;
  type: 'character' | 'world' | 'item' | 'hook' | 'rule';
}

interface KnowledgeState {
  entities: GraphEntity[];
  relations: RelationEdge[];
  loading: boolean;
  error: string | null;

  fetchAll: () => Promise<void>;
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
  entities: [],
  relations: [],
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [characters, world, items, hooks, rules, relations] = await Promise.all([
        api.get<Character[]>('/knowledge/characters'),
        api.get<WorldEntry[]>('/knowledge/world'),
        api.get<Item[]>('/knowledge/items'),
        api.get<Hook[]>('/knowledge/hooks'),
        api.get<Rule[]>('/knowledge/rules'),
        api.get<RelationEdge[]>('/knowledge/relations'),
      ]);
      set({
        entities: toEntities(characters, world, items, hooks, rules),
        relations,
        loading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  addRelation: async (data) => {
    try {
      const created = await api.post<RelationEdge>('/knowledge/relations', data);
      set({ relations: [...get().relations, created] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message });
    }
  },

  removeRelation: async (id) => {
    try {
      await api.del(`/knowledge/relations/${id}`);
      set({ relations: get().relations.filter((r) => r.id !== id) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message });
    }
  },
}));
