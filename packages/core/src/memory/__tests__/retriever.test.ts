import { describe, it, expect } from 'vitest';
import { retrieveRemoteMemory } from '../retriever.js';
import type { ChapterSummary, BatchSummary } from '../../models/memory.js';
import type { Hook, OutlineNode } from '../../models/knowledge.js';

const sum = (chapter: number, overrides: Partial<ChapterSummary> = {}): ChapterSummary => ({
  chapter,
  volume: 1,
  title: `第${chapter}章`,
  plotEvents: [],
  plotOutcome: `结果${chapter}`,
  charactersPresent: [],
  characterActions: {},
  newRevealedInfo: [],
  locationsUsed: [],
  hooksAdvanced: [],
  hooksPlanted: [],
  stateChanges: [],
  wordCount: 1000,
  ...overrides,
});

describe('retrieveRemoteMemory', () => {
  it('策略1：按关键词检索相关章节', () => {
    const summaries = [
      sum(1, { charactersPresent: ['张三'], plotOutcome: '张三登场' }),
      sum(2, { charactersPresent: ['李四'] }),
    ];
    const text = retrieveRemoteMemory({ keywords: ['张三'], summaries, currentChapter: 3 });
    expect(text).toContain('张三登场');
    expect(text).not.toContain('结果2');
  });

  it('策略2：active 伏笔沉默超阈值被列出', () => {
    const hook: Hook = {
      id: 'h1',
      name: '神秘符文',
      description: '主角身上的符文',
      status: 'active',
      plantedAt: 1,
      createdAt: 'x',
      updatedAt: 'x',
    };
    const text = retrieveRemoteMemory({
      keywords: [],
      summaries: [sum(1)],
      hooks: [hook],
      currentChapter: 10,
    });
    expect(text).toContain('待回收伏笔');
    expect(text).toContain('神秘符文');
  });

  it('策略2：近期提及的 active 伏笔不列出', () => {
    const hook: Hook = {
      id: 'h1',
      name: '伏笔A',
      description: 'd',
      status: 'active',
      plantedAt: 1,
      createdAt: 'x',
      updatedAt: 'x',
    };
    const summaries = [sum(8, { hooksAdvanced: ['伏笔A'] })];
    const text = retrieveRemoteMemory({
      keywords: [],
      summaries,
      hooks: [hook],
      currentChapter: 10,
    });
    expect(text).not.toContain('待回收伏笔'); // 10-8=2 < 5
  });

  it('策略2：resolved 伏笔不列出', () => {
    const hook: Hook = {
      id: 'h1',
      name: '已解伏笔',
      description: 'd',
      status: 'resolved',
      plantedAt: 1,
      createdAt: 'x',
      updatedAt: 'x',
    };
    const text = retrieveRemoteMemory({
      keywords: [],
      summaries: [],
      hooks: [hook],
      currentChapter: 100,
    });
    expect(text).not.toContain('已解伏笔');
  });

  it('策略3：大纲含回顾关键词的节点被列出', () => {
    const outline: OutlineNode[] = [
      { id: '1', type: 'chapter', title: '第11章', summary: '回顾第一卷伏笔', sortOrder: 1 },
      { id: '2', type: 'chapter', title: '第12章', summary: '日常推进', sortOrder: 2 },
    ];
    const text = retrieveRemoteMemory({
      keywords: [],
      summaries: [],
      outline,
      currentChapter: 11,
    });
    expect(text).toContain('大纲指引');
    expect(text).toContain('第11章');
    expect(text).not.toContain('日常推进');
  });

  it('策略4：综合总结兜底', () => {
    const batch: BatchSummary = {
      chapterRange: [1, 10],
      volume: 1,
      narrativeArc: '第一卷主线',
      turningPoints: [],
      characterDevelopment: {},
      unresolvedThreads: [],
    };
    const text = retrieveRemoteMemory({
      keywords: [],
      summaries: [],
      batchSummaries: [batch],
      currentChapter: 11,
    });
    expect(text).toContain('综合总结');
    expect(text).toContain('第一卷主线');
  });

  it('空输入返回空字符串', () => {
    expect(retrieveRemoteMemory({ keywords: [], summaries: [] })).toBe('');
  });

  it('超出预算截断并加省略号', () => {
    const summaries = Array.from({ length: 50 }, (_, i) =>
      sum(i + 1, { charactersPresent: ['张三'] }),
    );
    const text = retrieveRemoteMemory({
      keywords: ['张三'],
      summaries,
      currentChapter: 60,
      maxTokens: 10,
    });
    expect(text.length).toBeLessThanOrEqual(21); // 10*2 + 1
    expect(text.endsWith('…')).toBe(true);
  });
});
