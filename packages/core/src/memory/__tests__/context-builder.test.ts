import { describe, it, expect } from 'vitest';
import { buildMemoryContext } from '../context-builder.js';
import type { StoryStateSnapshot, ChapterSummary, Timeline } from '../../models/memory.js';

const storyState: StoryStateSnapshot = {
  lastPublishedChapter: 10,
  currentArc: '主角寻找神器',
  activeCharacters: ['张三', '李四'],
  currentLocation: '天元宗',
  recentEvents: ['突破金丹', '获得地图'],
  openQuestions: ['神器在哪？'],
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const summary = (chapter: number): ChapterSummary => ({
  chapter,
  volume: 1,
  title: `第${chapter}章`,
  plotEvents: [`事件${chapter}`],
  plotOutcome: `结果${chapter}`,
  charactersPresent: [],
  characterActions: {},
  newRevealedInfo: [],
  locationsUsed: [],
  hooksAdvanced: [],
  hooksPlanted: [],
  stateChanges: [],
  wordCount: 1000,
});

describe('buildMemoryContext', () => {
  it('组装三层 + token 预算', () => {
    const ctx = buildMemoryContext({
      model: 'gpt-4o',
      storyState,
      recentSummaries: [summary(8), summary(9), summary(10)],
      coreSettings: '【核心设定】主角张三',
    });
    expect(ctx.layer1).toContain('剧情状态');
    expect(ctx.layer1).toContain('主角寻找神器');
    expect(ctx.layer2).toContain('第10章');
    expect(ctx.budget.total).toBe(128000);
    expect(ctx.budget.layer3).toBeGreaterThan(0);
  });

  it('Layer2 取最近 N 章（按章节号）', () => {
    const ctx = buildMemoryContext({
      model: 'gpt-4o',
      recentSummaries: [summary(1), summary(2), summary(3), summary(4), summary(5), summary(6)],
      recentChapterCount: 3,
    });
    expect(ctx.layer2).toContain('第4章');
    expect(ctx.layer2).toContain('第6章');
    expect(ctx.layer2).not.toContain('第1章');
  });

  it('Layer3 无检索结果时用 timeline 兜底', () => {
    const timeline: Timeline = {
      entries: [{ chapter: 5, volume: 1, title: 'T', events: ['伏笔推进'], outcome: 'o' }],
      updatedAt: 'x',
    };
    const ctx = buildMemoryContext({ model: 'gpt-4o', timeline });
    expect(ctx.layer3).toContain('伏笔推进');
  });

  it('Layer3 优先使用 remoteRetrieved', () => {
    const ctx = buildMemoryContext({
      model: 'gpt-4o',
      remoteRetrieved: '【检索】相关远期内容',
      timeline: { entries: [{ chapter: 5, volume: 1, title: 'T', events: ['兜底'], outcome: 'o' }], updatedAt: 'x' },
    });
    expect(ctx.layer3).toContain('相关远期内容');
    expect(ctx.layer3).not.toContain('兜底');
  });

  it('空输入不报错，layer1/layer2 为空', () => {
    const ctx = buildMemoryContext({ model: 'gpt-4o' });
    expect(ctx.layer1).toBe('');
    expect(ctx.layer2).toBe('');
  });

  it('超出 Layer1 预算时截断并加省略号', () => {
    const huge = 'A'.repeat(100000);
    const ctx = buildMemoryContext({ model: 'gpt-4o', coreSettings: huge });
    expect(ctx.layer1.length).toBeLessThan(100000);
    expect(ctx.layer1.endsWith('…')).toBe(true);
  });
});
