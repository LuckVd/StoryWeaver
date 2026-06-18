import { describe, it, expect } from 'vitest';
import { aggregateTimeline, aggregateCharacterStates } from '../aggregator.js';
import type { ChapterSummary } from '../../models/memory.js';

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

describe('aggregateTimeline', () => {
  it('空数组返回空 entries 且带 updatedAt', () => {
    const t = aggregateTimeline([]);
    expect(t.entries).toEqual([]);
    expect(typeof t.updatedAt).toBe('string');
  });

  it('按 chapter 升序排列（输入乱序）', () => {
    const t = aggregateTimeline([
      makeSummary({ chapter: 3 }),
      makeSummary({ chapter: 1 }),
      makeSummary({ chapter: 2 }),
    ]);
    expect(t.entries.map((e) => e.chapter)).toEqual([1, 2, 3]);
  });

  it('映射 plotEvents/plotOutcome，narrativeTime 可选', () => {
    const t = aggregateTimeline([
      makeSummary({ chapter: 1, plotEvents: ['a', 'b'], plotOutcome: '结果', narrativeTime: '第三日' }),
      makeSummary({ chapter: 2, plotEvents: ['c'], plotOutcome: '另一结果' }),
    ]);
    expect(t.entries[0]).toMatchObject({ events: ['a', 'b'], outcome: '结果', narrativeTime: '第三日' });
    expect(t.entries[1].narrativeTime).toBeUndefined();
    expect(t.entries[1].events).toEqual(['c']);
  });

  it('不修改入参数组', () => {
    const input = [makeSummary({ chapter: 2 }), makeSummary({ chapter: 1 })];
    aggregateTimeline(input);
    expect(input.map((s) => s.chapter)).toEqual([2, 1]);
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
