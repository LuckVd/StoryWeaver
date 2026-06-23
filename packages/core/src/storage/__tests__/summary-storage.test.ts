import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SummaryStorage } from '../summary-storage.js';
import { SqliteCache } from '../cache/sqlite-cache.js';
import { summaryFilePath, batchSummaryFilePath } from '../path.js';
import type { ChapterSummary, BatchSummary, StoryStateSnapshot } from '../../models/memory.js';

describe('SummaryStorage with SQLite cache', () => {
  let projectRoot: string;
  let cache: SqliteCache;
  let storage: SummaryStorage;

  const makeSummary = (chapter: number): ChapterSummary => ({
    chapter,
    volume: 1,
    title: `Ch ${chapter}`,
    plotEvents: [`event ${chapter}`],
    plotOutcome: `outcome ${chapter}`,
    charactersPresent: ['角色A'],
    characterActions: { '角色A': `行动${chapter}` },
    newRevealedInfo: [`info ${chapter}`],
    locationsUsed: ['地点X'],
    hooksAdvanced: [],
    hooksPlanted: [],
    stateChanges: [],
    narrativeTime: '第一天',
    wordCount: 1000,
  });

  beforeEach(async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-summary-cache-'));
    cache = await SqliteCache.open(join(projectRoot, 'memory', '.cache', 'cache.db'));
    storage = new SummaryStorage(cache);
  });

  afterEach(() => {
    cache.close();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('save 后 get 走缓存(底层文件删除仍可读)', async () => {
    const summary = makeSummary(1);
    await storage.saveChapterSummary(projectRoot, summary);
    rmSync(summaryFilePath(projectRoot, 1), { force: true }); // 删底层文件
    const result = await storage.getChapterSummary(projectRoot, 1);
    expect(result).toEqual(summary); // 从缓存读
  });

  it('list 走缓存(底层文件删除仍列出)', async () => {
    await storage.saveChapterSummary(projectRoot, makeSummary(2));
    await storage.saveChapterSummary(projectRoot, makeSummary(3));
    await storage.listChapterSummaries(projectRoot); // 先填充缓存
    rmSync(summaryFilePath(projectRoot, 2), { force: true });
    rmSync(summaryFilePath(projectRoot, 3), { force: true });
    const list = await storage.listChapterSummaries(projectRoot);
    expect(list.map((s) => s.chapter)).toEqual([2, 3]); // 从缓存
  });

  it('delete 同步删除缓存', async () => {
    await storage.saveChapterSummary(projectRoot, makeSummary(4));
    await storage.deleteChapterSummary(projectRoot, 4);
    expect(await storage.getChapterSummary(projectRoot, 4)).toBeNull();
  });

  it('缓存命中后 save 覆盖会更新缓存', async () => {
    await storage.saveChapterSummary(projectRoot, makeSummary(5));
    await storage.saveChapterSummary(projectRoot, { ...makeSummary(5), title: 'Updated' });
    rmSync(summaryFilePath(projectRoot, 5), { force: true });
    expect((await storage.getChapterSummary(projectRoot, 5))?.title).toBe('Updated');
  });

  it('空缓存 list 降级文件并回填', async () => {
    const freshRoot = mkdtempSync(join(tmpdir(), 'sw-summary-fallback-'));
    const freshCache = await SqliteCache.open(join(freshRoot, 'memory', '.cache', 'cache.db'));
    const freshStorage = new SummaryStorage(freshCache);
    try {
      await freshStorage.saveChapterSummary(projectRoot, makeSummary(7));
      const list = await freshStorage.listChapterSummaries(projectRoot); // 降级文件 + 回填
      expect(list.map((s) => s.chapter)).toContain(7);
      rmSync(summaryFilePath(projectRoot, 7), { force: true });
      const list2 = await freshStorage.listChapterSummaries(projectRoot); // 这次走缓存
      expect(list2.map((s) => s.chapter)).toContain(7);
    } finally {
      freshCache.close();
      rmSync(freshRoot, { recursive: true, force: true });
    }
  });

  it('rebuildSummariesCache 从文件全量重建(含绕过 storage 写入的文件)', async () => {
    const r = mkdtempSync(join(tmpdir(), 'sw-summary-rebuild-'));
    const c = await SqliteCache.open(join(r, 'memory', '.cache', 'cache.db'));
    const s = new SummaryStorage(c);
    try {
      await s.saveChapterSummary(r, makeSummary(1));
      await s.saveChapterSummary(r, makeSummary(2));
      writeFileSync(summaryFilePath(r, 3), JSON.stringify(makeSummary(3), null, 2), 'utf-8'); // 绕过 storage
      const { chapters } = await s.rebuildSummariesCache(r);
      expect(chapters).toBe(3);
      rmSync(summaryFilePath(r, 1), { force: true });
      expect((await s.getChapterSummary(r, 1))?.chapter).toBe(1); // 从缓存
    } finally {
      c.close();
      rmSync(r, { recursive: true, force: true });
    }
  });

  it('batch 综合总结也走缓存', async () => {
    const batch: BatchSummary = {
      chapterRange: [1, 10],
      volume: 1,
      narrativeArc: 'arc',
      turningPoints: ['tp'],
      characterDevelopment: { '角色A': 'dev' },
      unresolvedThreads: ['thread'],
    };
    await storage.saveBatchSummary(projectRoot, batch);
    rmSync(batchSummaryFilePath(projectRoot, 1, 10), { force: true });
    expect(await storage.getBatchSummary(projectRoot, 1, 10)).toEqual(batch);
  });
});

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

  describe('character-states', () => {
    it('rebuild 从章节摘要聚合出角色状态并持久化', async () => {
      await storage.saveChapterSummary(projectRoot, {
        ...makeChapterSummary(1),
        stateChanges: [{ entity: '张三', field: '修为', from: '炼气', to: '筑基' }],
      });
      await storage.saveChapterSummary(projectRoot, {
        ...makeChapterSummary(2),
        stateChanges: [{ entity: '张三', field: '修为', from: '筑基', to: '金丹' }],
      });

      const characterStates = await storage.rebuildCharacterStates(projectRoot);
      const zhang = characterStates.characters.find((c) => c.entity === '张三');
      expect(zhang?.currentState).toEqual({ 修为: '金丹' });

      // 持久化后可读回
      const storedStates = await storage.getCharacterStates(projectRoot);
      expect(storedStates?.characters.length).toBe(characterStates.characters.length);
    });

    it('无摘要时 rebuild 返回空 characterStates 且不报错', async () => {
      const freshRoot = mkdtempSync(join(tmpdir(), 'sw-mem-empty-'));
      try {
        const characterStates = await storage.rebuildCharacterStates(freshRoot);
        expect(characterStates.characters).toEqual([]);
      } finally {
        rmSync(freshRoot, { recursive: true, force: true });
      }
    });

    it('save/get character-states 往返', async () => {
      await storage.saveCharacterStates(projectRoot, {
        characters: [{ entity: 'X', currentState: { a: 'b' }, history: [] }],
        updatedAt: '2026-01-02T00:00:00.000Z',
      });
      const cs = await storage.getCharacterStates(projectRoot);
      expect(cs?.characters[0].entity).toBe('X');
    });
  });
});
