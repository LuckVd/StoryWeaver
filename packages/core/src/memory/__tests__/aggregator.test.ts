import { describe, it, expect } from 'vitest';
import { aggregateCharacterStates, aggregateHooksTracking } from '../aggregator.js';
import type { ChapterSummary } from '../../models/memory.js';
import type { Hook } from '../../models/knowledge.js';

function makeSummary(overrides: Partial<ChapterSummary> & { chapter: number }): ChapterSummary {
  return {
    chapter: overrides.chapter,
    volume: overrides.volume ?? 1,
    title: overrides.title ?? `Ch${overrides.chapter}`,
    plotEvents: overrides.plotEvents ?? [],
    plotOutcome: overrides.plotOutcome ?? '',
    charactersPresent: overrides.charactersPresent ?? [],
    characterActions: overrides.characterActions ?? {},
    newRevealedInfo: overrides.newRevealedInfo ?? [],
    locationsUsed: overrides.locationsUsed ?? [],
    hooksAdvanced: overrides.hooksAdvanced ?? [],
    hooksPlanted: overrides.hooksPlanted ?? [],
    stateChanges: overrides.stateChanges ?? [],
    narrativeTime: overrides.narrativeTime,
    wordCount: overrides.wordCount ?? 0,
  };
}

function makeHook(overrides: Partial<Hook> & { name: string }): Hook {
  return {
    id: overrides.id ?? overrides.name,
    name: overrides.name,
    description: overrides.description ?? 'd',
    status: overrides.status ?? 'active',
    plantedAt: overrides.plantedAt ?? 1,
    resolvedAt: overrides.resolvedAt,
    relatedEntities: overrides.relatedEntities,
    createdAt: 'x',
    updatedAt: 'x',
  };
}

describe('aggregateHooksTracking', () => {
  it('空 hooks 返回空数组', () => {
    expect(aggregateHooksTracking([], [], 10)).toEqual([]);
  });

  it('聚合 mentions（planted/advanced），lastMention 取最大章', () => {
    const hooks = [makeHook({ name: '神秘符文', plantedAt: 1 })];
    const summaries = [
      makeSummary({ chapter: 1, hooksPlanted: ['神秘符文'] }),
      makeSummary({ chapter: 3, hooksAdvanced: ['神秘符文'] }),
      makeSummary({ chapter: 5, hooksAdvanced: ['神秘符文'] }),
    ];
    const result = aggregateHooksTracking(hooks, summaries, 10);
    expect(result).toHaveLength(1);
    expect(result[0].lastMention).toBe(5);
    expect(result[0].silentChapters).toBe(5);
    expect(result[0].mentions).toEqual([
      { chapter: 1, type: 'planted' },
      { chapter: 3, type: 'advanced' },
      { chapter: 5, type: 'advanced' },
    ]);
  });

  it('无 mentions 时 lastMention 用 plantedAt', () => {
    const hooks = [makeHook({ name: '伏笔A', plantedAt: 2 })];
    const result = aggregateHooksTracking(hooks, [], 10);
    expect(result[0].lastMention).toBe(2);
    expect(result[0].silentChapters).toBe(8);
  });

  it('按沉默章数降序排列（沉默久者优先）', () => {
    const hooks = [makeHook({ name: 'A', plantedAt: 1 }), makeHook({ name: 'B', plantedAt: 1 })];
    const summaries = [makeSummary({ chapter: 8, hooksAdvanced: ['B'] })];
    const result = aggregateHooksTracking(hooks, summaries, 10);
    expect(result.map((h) => h.name)).toEqual(['A', 'B']); // A 沉默9 > B 沉默2
  });
});

describe('aggregateCharacterStates', () => {
  it('空数组返回空 characters', () => {
    const cs = aggregateCharacterStates([]);
    expect(cs.characters).toEqual([]);
  });

  it('同 entity 多次变迁：currentState 取最后一次 to，history 全保留', () => {
    const cs = aggregateCharacterStates([
      makeSummary({ chapter: 1, stateChanges: [{ entity: '张三', field: '修为', from: '炼气', to: '筑基' }] }),
      makeSummary({ chapter: 5, stateChanges: [{ entity: '张三', field: '修为', from: '筑基', to: '金丹' }] }),
    ]);
    expect(cs.characters).toHaveLength(1);
    expect(cs.characters[0].currentState).toEqual({ 修为: '金丹' });
    expect(cs.characters[0].history).toEqual([
      { chapter: 1, field: '修为', from: '炼气', to: '筑基' },
      { chapter: 5, field: '修为', from: '筑基', to: '金丹' },
    ]);
  });

  it('多角色各自聚合，history 按 chapter 升序', () => {
    const cs = aggregateCharacterStates([
      makeSummary({ chapter: 3, stateChanges: [{ entity: '李四', field: '位置', from: 'A', to: 'B' }] }),
      makeSummary({ chapter: 1, stateChanges: [{ entity: '张三', field: '状态', from: 'x', to: 'y' }] }),
      makeSummary({ chapter: 2, stateChanges: [{ entity: '张三', field: '状态', from: 'y', to: 'z' }] }),
    ]);
    expect(cs.characters).toHaveLength(2);
    const byEntity = Object.fromEntries(cs.characters.map((c) => [c.entity, c]));
    expect(byEntity['张三'].currentState).toEqual({ 状态: 'z' });
    expect(byEntity['张三'].history.map((h) => h.chapter)).toEqual([1, 2]);
    expect(byEntity['李四'].currentState).toEqual({ 位置: 'B' });
  });

  it('同角色不同 field 互不覆盖', () => {
    const cs = aggregateCharacterStates([
      makeSummary({
        chapter: 1,
        stateChanges: [
          { entity: '张三', field: '修为', from: 'a', to: 'b' },
          { entity: '张三', field: '位置', from: 'c', to: 'd' },
        ],
      }),
    ]);
    expect(cs.characters[0].currentState).toEqual({ 修为: 'b', 位置: 'd' });
  });

  it('乱序章节输入仍按 chapter 升序聚合 history', () => {
    const cs = aggregateCharacterStates([
      makeSummary({ chapter: 5, stateChanges: [{ entity: '王五', field: 'f', from: '1', to: '2' }] }),
      makeSummary({ chapter: 1, stateChanges: [{ entity: '王五', field: 'f', from: '0', to: '1' }] }),
    ]);
    expect(cs.characters[0].history.map((h) => h.chapter)).toEqual([1, 5]);
    expect(cs.characters[0].currentState).toEqual({ f: '2' });
  });
});
