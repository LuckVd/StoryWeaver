import { describe, it, expect, vi } from 'vitest';
import { buildInjection, coordinateBudget } from '../injection-builder.js';
import type { InjectionInput } from '../injection-builder.js';
import type { Rule } from '../../models/knowledge.js';
import type { ChapterSummary, StoryStateSnapshot } from '../../models/memory.js';
import type { InMemorySearchEngine, SearchResult } from '../../search/index.js';
import type { OutlineNode } from '../../models/knowledge.js';

function mockSearchEngine(results: SearchResult[]): InMemorySearchEngine {
  return { search: vi.fn(() => results) } as unknown as InMemorySearchEngine;
}

function mkRule(id: string, name: string, priority: Rule['priority']): Rule {
  return { id, category: 'custom', name, content: `${name}内容`, priority, createdAt: '', updatedAt: '' };
}

function mkSummary(chapter: number, title: string): ChapterSummary {
  return {
    chapter,
    volume: 1,
    title,
    plotEvents: [],
    plotOutcome: `${title}结果`,
    charactersPresent: [],
    characterActions: {},
    newRevealedInfo: [],
    locationsUsed: [],
    hooksAdvanced: [],
    hooksPlanted: [],
    stateChanges: [],
    wordCount: 100,
  };
}

function mkArc(id: number, title: string, summary?: string, range?: [number, number]): OutlineNode {
  return { id: `a${id}`, type: 'arc', title, summary, chapterRange: range, sortOrder: id };
}

function baseInput(overrides: Partial<InjectionInput> = {}): InjectionInput {
  return {
    model: 'glm-4',
    systemPrompt: '你是写作助手',
    chapter: null,
    activeArc: { current: null, next: null },
    rules: [],
    storyState: null,
    entities: [],
    summaries: [],
    hooks: [],
    batchSummaries: [],
    characterStates: null,
    dialogChars: 0,
    currentChapter: 0,
    ...overrides,
  };
}

describe('injection-builder', () => {
  describe('coordinateBudget', () => {
    it('① + 对话 + 输出预留后,②③④ 按比例分配', () => {
      // 128000 - 5000 - 4000 - 3000 = 116000;②=23200;③=(116000-23200)*0.6=55680
      const b = coordinateBudget('glm-4', 5000, 3000);
      expect(b.constant).toBe(5000);
      expect(b.chapterContext).toBe(23200);
      expect(b.retrieved).toBe(55680);
      expect(b.budgetFill).toBeGreaterThan(0);
    });

    it('① 过大挤压窗口时 ②③④ 归零但①不丢', () => {
      // gpt-3.5-turbo 窗口 16385;①16000 + 输出4000 > 窗口 → remaining=0
      const b = coordinateBudget('gpt-3.5-turbo', 16000, 0);
      expect(b.constant).toBe(16000);
      expect(b.chapterContext).toBe(0);
      expect(b.retrieved).toBe(0);
      expect(b.budgetFill).toBe(0);
    });
  });

  describe('buildInjection', () => {
    it('① 含 systemPrompt + 规则全量 + 剧情方向 + 状态', () => {
      const r = buildInjection(
        baseInput({
          rules: [mkRule('r1', '禁穿越', 'high'), mkRule('r2', '人称', 'low')],
          activeArc: {
            current: mkArc(3, '第二卷·抗争', '与反派冲突', [15, 40]),
            next: mkArc(4, '第三卷·陨落', '代价与重生', [41, 60]),
          },
          storyState: {
            lastPublishedChapter: 2,
            currentArc: '主线',
            activeCharacters: ['张三'],
            currentLocation: '京城',
            recentEvents: ['e1'],
            openQuestions: ['q1'],
            updatedAt: '',
          } as StoryStateSnapshot,
        }),
      );
      expect(r.constant).toContain('你是写作助手');
      expect(r.constant).toContain('禁穿越');
      expect(r.constant).toContain('人称');
      expect(r.constant).toContain('[当前卷] 第二卷·抗争(第15-40章)');
      expect(r.constant).toContain('方向: 与反派冲突');
      expect(r.constant).toContain('[下一卷] 第三卷·陨落');
      expect(r.constant).toContain('当前主线:主线');
    });

    it('规则按优先级排序(high 在前)', () => {
      const r = buildInjection(
        baseInput({ rules: [mkRule('r1', '低优', 'low'), mkRule('r2', '高优', 'high')] }),
      );
      expect(r.constant.indexOf('高优')).toBeLessThan(r.constant.indexOf('低优'));
    });

    it('② 含章节标题/卷序 + 尾部正文', () => {
      const r = buildInjection(
        baseInput({
          chapter: { id: 5, title: '决战', volumeTitle: '第二卷', contentTail: '他拔剑。' },
        }),
      );
      expect(r.chapterContext).toContain('第5章「决战」');
      expect(r.chapterContext).toContain('第二卷');
      expect(r.chapterContext).toContain('他拔剑。');
    });

    it('③ 含按实体检索的相关设定', () => {
      const se = mockSearchEngine([
        { type: 'knowledge', id: 'k1', title: '张三', snippet: '主角', score: 1 },
      ]);
      const r = buildInjection(baseInput({ searchEngine: se, entities: ['张三'] }));
      expect(r.retrieved).toContain('张三');
      expect(r.retrieved).toContain('主角');
    });

    it('④ 近章摘要按近→远排列', () => {
      const r = buildInjection(
        baseInput({
          summaries: [mkSummary(3, '三章'), mkSummary(1, '一章'), mkSummary(2, '二章')],
        }),
      );
      expect(r.budgetFill).toContain('三章');
      expect(r.budgetFill.indexOf('三章')).toBeLessThan(r.budgetFill.indexOf('二章'));
    });

    it('长正文尾部按②预算截断(小窗口)', () => {
      const longTail = '字'.repeat(50000);
      const r = buildInjection(
        baseInput({
          model: 'gpt-3.5-turbo',
          chapter: { id: 1, title: 't', contentTail: longTail },
        }),
      );
      expect(r.chapterContext.length).toBeLessThan(longTail.length);
      expect(r.chapterContext.endsWith('…')).toBe(true);
    });

    it('无章节绑定时 ② 为空', () => {
      const r = buildInjection(baseInput());
      expect(r.chapterContext).toBe('');
    });

    it('极端:小窗口 + 大量规则 → ①规则全保,②③④让位', () => {
      const rules = Array.from({ length: 60 }, (_, i) => mkRule(`r${i}`, `规则${i}`, 'high'));
      const r = buildInjection(
        baseInput({
          model: 'gpt-3.5-turbo',
          rules,
          chapter: { id: 1, title: 't', contentTail: '字'.repeat(50000) },
          summaries: [mkSummary(1, 's1'), mkSummary(2, 's2')],
        }),
      );
      // ① 所有规则全保(恒定档不截断,溢出从②③④丢)
      for (let i = 0; i < 60; i++) {
        expect(r.constant).toContain(`规则${i}`);
      }
      // ② 长正文被截断,不溢出
      expect(r.chapterContext.length).toBeLessThan(50000);
    });
  });
});
