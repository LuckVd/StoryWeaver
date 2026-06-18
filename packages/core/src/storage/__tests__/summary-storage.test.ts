import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SummaryStorage } from '../summary-storage.js';
import type { ChapterSummary, BatchSummary, StoryStateSnapshot } from '../../models/memory.js';

describe('SummaryStorage', () => {
  let projectRoot: string;
  let storage: SummaryStorage;

  beforeAll(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-summary-test-'));
    storage = new SummaryStorage();
  });

  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  // ── ChapterSummary ──

  const makeChapterSummary = (chapter: number): ChapterSummary => ({
    chapter,
    volume: 1,
    title: `Chapter ${chapter}`,
    plotEvents: [`Event A of chapter ${chapter}`],
    plotOutcome: `Outcome of chapter ${chapter}`,
    charactersPresent: ['角色A'],
    characterActions: { '角色A': `行动 ${chapter}` },
    newRevealedInfo: [`新信息 ${chapter}`],
    locationsUsed: ['地点X'],
    hooksAdvanced: [],
    hooksPlanted: [],
    stateChanges: [],
    narrativeTime: '第三天',
    wordCount: 1000 + chapter * 100,
  });

  describe('chapter summaries', () => {
    it('should save and read a chapter summary', async () => {
      const summary = makeChapterSummary(1);
      await storage.saveChapterSummary(projectRoot, summary);

      const result = await storage.getChapterSummary(projectRoot, 1);
      expect(result).toEqual(summary);
    });

    it('should return null for non-existent chapter', async () => {
      const result = await storage.getChapterSummary(projectRoot, 999);
      expect(result).toBeNull();
    });

    it('should list all chapter summaries sorted by chapter', async () => {
      await storage.saveChapterSummary(projectRoot, makeChapterSummary(3));
      await storage.saveChapterSummary(projectRoot, makeChapterSummary(1));
      await storage.saveChapterSummary(projectRoot, makeChapterSummary(5));

      const list = await storage.listChapterSummaries(projectRoot);
      expect(list.map((s) => s.chapter)).toEqual([1, 3, 5]);
    });

    it('should overwrite existing summary on save', async () => {
      await storage.saveChapterSummary(projectRoot, makeChapterSummary(1));
      const updated = { ...makeChapterSummary(1), title: 'Updated Title' };
      await storage.saveChapterSummary(projectRoot, updated);

      const result = await storage.getChapterSummary(projectRoot, 1);
      expect(result?.title).toBe('Updated Title');
    });

    it('should delete a chapter summary', async () => {
      await storage.saveChapterSummary(projectRoot, makeChapterSummary(10));
      const deleted = await storage.deleteChapterSummary(projectRoot, 10);
      expect(deleted).toBe(true);

      const result = await storage.getChapterSummary(projectRoot, 10);
      expect(result).toBeNull();
    });

    it('should return false when deleting non-existent summary', async () => {
      const deleted = await storage.deleteChapterSummary(projectRoot, 777);
      expect(deleted).toBe(false);
    });

    it('should return empty list when no summaries exist', async () => {
      const freshRoot = mkdtempSync(join(tmpdir(), 'sw-summary-empty-'));
      try {
        const list = await storage.listChapterSummaries(freshRoot);
        expect(list).toEqual([]);
      } finally {
        rmSync(freshRoot, { recursive: true, force: true });
      }
    });
  });

  // ── BatchSummary ──

  const makeBatchSummary = (from: number, to: number): BatchSummary => ({
    chapterRange: [from, to],
    volume: 1,
    narrativeArc: `Arc from ${from} to ${to}`,
    turningPoints: ['转折1'],
    characterDevelopment: { '角色A': '成长' },
    unresolvedThreads: ['悬念1'],
  });

  describe('batch summaries', () => {
    it('should save and read a batch summary', async () => {
      const summary = makeBatchSummary(1, 10);
      await storage.saveBatchSummary(projectRoot, summary);

      const result = await storage.getBatchSummary(projectRoot, 1, 10);
      expect(result).toEqual(summary);
    });

    it('should return null for non-existent batch', async () => {
      const result = await storage.getBatchSummary(projectRoot, 99, 100);
      expect(result).toBeNull();
    });

    it('should list all batch summaries sorted by range start', async () => {
      await storage.saveBatchSummary(projectRoot, makeBatchSummary(21, 30));
      await storage.saveBatchSummary(projectRoot, makeBatchSummary(1, 10));
      await storage.saveBatchSummary(projectRoot, makeBatchSummary(11, 20));

      const list = await storage.listBatchSummaries(projectRoot);
      expect(list.map((s) => s.chapterRange)).toEqual([[1, 10], [11, 20], [21, 30]]);
    });

    it('should delete a batch summary', async () => {
      await storage.saveBatchSummary(projectRoot, makeBatchSummary(50, 60));
      const deleted = await storage.deleteBatchSummary(projectRoot, 50, 60);
      expect(deleted).toBe(true);

      const result = await storage.getBatchSummary(projectRoot, 50, 60);
      expect(result).toBeNull();
    });
  });

  // ── StoryStateSnapshot ──

  const makeStoryState = (): StoryStateSnapshot => ({
    lastPublishedChapter: 10,
    currentArc: '主角突破金丹期',
    activeCharacters: ['角色A', '角色B'],
    currentLocation: '天元宗',
    recentEvents: ['突破成功', '获得法宝'],
    openQuestions: ['师父去了哪里？'],
    updatedAt: new Date().toISOString(),
  });

  describe('story state', () => {
    it('should save and read story state', async () => {
      const state = makeStoryState();
      await storage.saveStoryState(projectRoot, state);

      const result = await storage.getStoryState(projectRoot);
      expect(result).toEqual(state);
    });

    it('should return null when no story state exists', async () => {
      const freshRoot = mkdtempSync(join(tmpdir(), 'sw-state-empty-'));
      try {
        const result = await storage.getStoryState(freshRoot);
        expect(result).toBeNull();
      } finally {
        rmSync(freshRoot, { recursive: true, force: true });
      }
    });

    it('should overwrite existing story state on save', async () => {
      await storage.saveStoryState(projectRoot, makeStoryState());
      const updated = { ...makeStoryState(), lastPublishedChapter: 20 };
      await storage.saveStoryState(projectRoot, updated);

      const result = await storage.getStoryState(projectRoot);
      expect(result?.lastPublishedChapter).toBe(20);
    });
  });

  // ── Timeline & CharacterStates（G03-S04） ──

  describe('timeline and character-states', () => {
    it('rebuild 从章节摘要聚合出时间线 + 角色状态并持久化', async () => {
      await storage.saveChapterSummary(projectRoot, {
        ...makeChapterSummary(1),
        stateChanges: [{ entity: '张三', field: '修为', from: '炼气', to: '筑基' }],
      });
      await storage.saveChapterSummary(projectRoot, {
        ...makeChapterSummary(2),
        plotEvents: ['张三突破金丹'],
        stateChanges: [{ entity: '张三', field: '修为', from: '筑基', to: '金丹' }],
      });

      const { timeline, characterStates } =
        await storage.rebuildTimelineAndCharacterStates(projectRoot);

      expect(timeline.entries.map((e) => e.chapter)).toEqual(expect.arrayContaining([1, 2]));
      const zhang = characterStates.characters.find((c) => c.entity === '张三');
      expect(zhang?.currentState).toEqual({ 修为: '金丹' });

      // 持久化后可读回
      const storedTimeline = await storage.getTimeline(projectRoot);
      const storedStates = await storage.getCharacterStates(projectRoot);
      expect(storedTimeline?.entries.length).toBe(timeline.entries.length);
      expect(storedStates?.characters.length).toBe(characterStates.characters.length);
    });

    it('无摘要时 rebuild 返回空派生视图且不报错', async () => {
      const freshRoot = mkdtempSync(join(tmpdir(), 'sw-mem-empty-'));
      try {
        const { timeline, characterStates } =
          await storage.rebuildTimelineAndCharacterStates(freshRoot);
        expect(timeline.entries).toEqual([]);
        expect(characterStates.characters).toEqual([]);
        // rebuild 即使无摘要也写入空派生视图（标记已重建，对前端友好）
        const storedTimeline = await storage.getTimeline(freshRoot);
        expect(storedTimeline?.entries).toEqual([]);
      } finally {
        rmSync(freshRoot, { recursive: true, force: true });
      }
    });

    it('save/get timeline 与 character-states 往返', async () => {
      await storage.saveTimeline(projectRoot, {
        entries: [{ chapter: 9, volume: 1, title: 'T', events: ['e'], outcome: 'o' }],
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
      const t = await storage.getTimeline(projectRoot);
      expect(t?.entries[0].chapter).toBe(9);
      expect(t?.updatedAt).toBe('2026-01-01T00:00:00.000Z');

      await storage.saveCharacterStates(projectRoot, {
        characters: [{ entity: 'X', currentState: { a: 'b' }, history: [] }],
        updatedAt: '2026-01-02T00:00:00.000Z',
      });
      const cs = await storage.getCharacterStates(projectRoot);
      expect(cs?.characters[0].entity).toBe('X');
    });
  });
});
