import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import {
  ensureDir,
  memoryDir,
  summariesDir,
  summaryFilePath,
  batchSummariesDir,
  batchSummaryFilePath,
  storyStateFilePath,
  characterStatesFilePath,
  curationSuggestionsFilePath,
  actionLogFilePath,
} from './path.js';
import type {
  ChapterSummary,
  BatchSummary,
  StoryStateSnapshot,
  CharacterStates,
  CurationSuggestion,
  CurationSuggestions,
  ActionLog,
  ActionLogEntry,
} from '../models/memory.js';
import { aggregateCharacterStates } from '../memory/aggregator.js';
import { CacheStore } from './cache/cache-store.js';
import type { SqliteCache } from './cache/sqlite-cache.js';

/** 缓存 scope 常量 */
const CHAPTER_SUMMARY_SCOPE = 'chapter-summaries';
const BATCH_SUMMARY_SCOPE = 'batch-summaries';

/** 章节 key:ch001 */
const chapterKey = (chapter: number): string => `ch${String(chapter).padStart(3, '0')}`;
/** 综合 key:batch-001-010 */
const batchKey = (from: number, to: number): string =>
  `batch-${String(from).padStart(3, '0')}-${String(to).padStart(3, '0')}`;

/** curation 缓存 scope / key(按章节) */
const CURATION_SCOPE = 'curation';
const CURATION_META_KEY = '__meta__';
const curationKey = (chapter: number): string => `ch${String(chapter).padStart(4, '0')}`;
/** action-log 缓存 scope / key(顺序自增,padded 保证排序) */
const ACTION_LOG_SCOPE = 'action-log';
const logKey = (seq: number): string => String(seq).padStart(8, '0');

/**
 * 摘要存储层
 *
 * 管理 AI 生成的结构化记忆:
 * - ChapterSummary — 每章摘要(memory/summaries/chXXX.json)
 * - BatchSummary — 多章综合总结(memory/batch-summaries/batch-XXX-XXX.json)
 * - StoryStateSnapshot — 剧情状态快照(memory/story-state.json)
 *
 * G04-S02:ChapterSummary / BatchSummary 的高频读取接入 SQLite 缓存。
 * 文件仍是唯一主存储 —— 写操作 write-through 同步缓存,读操作缓存优先、
 * 缓存缺失降级文件并回填,缓存可从文件全量重建(rebuildSummariesCache)。
 * 未注入 cache 时行为与纯文件实现完全一致。
 */
export class SummaryStorage {
  private readonly chapterStore?: CacheStore;
  private readonly batchStore?: CacheStore;
  private readonly curationStore?: CacheStore;
  private readonly actionLogStore?: CacheStore;

  constructor(cache?: SqliteCache) {
    if (cache) {
      this.chapterStore = new CacheStore(cache, CHAPTER_SUMMARY_SCOPE);
      this.batchStore = new CacheStore(cache, BATCH_SUMMARY_SCOPE);
      this.curationStore = new CacheStore(cache, CURATION_SCOPE);
      this.actionLogStore = new CacheStore(cache, ACTION_LOG_SCOPE);
    }
  }

  // ── ChapterSummary ──

  /** 保存章节摘要(覆盖写入) */
  async saveChapterSummary(projectRoot: string, summary: ChapterSummary): Promise<void> {
    const dir = summariesDir(projectRoot);
    await ensureDir(dir);
    const filePath = summaryFilePath(projectRoot, summary.chapter);
    await writeFile(filePath, JSON.stringify(summary, null, 2), 'utf-8');
    this.chapterStore?.put(chapterKey(summary.chapter), JSON.stringify(summary)); // write-through
  }

  /** 读取单章摘要 */
  async getChapterSummary(projectRoot: string, chapter: number): Promise<ChapterSummary | null> {
    if (this.chapterStore) {
      const cached = this.chapterStore.get(chapterKey(chapter));
      if (cached) return JSON.parse(cached) as ChapterSummary;
    }
    const filePath = summaryFilePath(projectRoot, chapter);
    try {
      const data = await readFile(filePath, 'utf-8');
      const summary = JSON.parse(data) as ChapterSummary;
      this.chapterStore?.put(chapterKey(chapter), JSON.stringify(summary)); // 回填
      return summary;
    } catch {
      return null;
    }
  }

  /** 从文件列出所有章节摘要(绕过缓存,按章节号排序) */
  private async listChapterSummariesFromFiles(projectRoot: string): Promise<ChapterSummary[]> {
    const dir = summariesDir(projectRoot);
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }
    const summaries: ChapterSummary[] = [];
    for (const entry of entries) {
      if (!entry.startsWith('ch') || !entry.endsWith('.json')) continue;
      try {
        const data = await readFile(`${dir}/${entry}`, 'utf-8');
        summaries.push(JSON.parse(data) as ChapterSummary);
      } catch {
        // 跳过损坏文件
      }
    }
    return summaries.sort((a, b) => a.chapter - b.chapter);
  }

  /** 列出所有章节摘要(按章节号排序) */
  async listChapterSummaries(projectRoot: string): Promise<ChapterSummary[]> {
    if (this.chapterStore) {
      const cached = this.chapterStore.listValues();
      if (cached.length) {
        return cached
          .map((s) => JSON.parse(s) as ChapterSummary)
          .sort((a, b) => a.chapter - b.chapter);
      }
    }
    const summaries = await this.listChapterSummariesFromFiles(projectRoot);
    if (this.chapterStore && summaries.length) {
      this.chapterStore.putMany(
        summaries.map((s) => ({ key: chapterKey(s.chapter), value: JSON.stringify(s) })),
      );
    }
    return summaries;
  }

  /** 删除单章摘要 */
  async deleteChapterSummary(projectRoot: string, chapter: number): Promise<boolean> {
    const filePath = summaryFilePath(projectRoot, chapter);
    try {
      await unlink(filePath);
    } catch {
      return false;
    }
    this.chapterStore?.delete(chapterKey(chapter)); // write-through 删除
    return true;
  }

  // ── BatchSummary ──

  /** 保存多章综合总结(覆盖写入) */
  async saveBatchSummary(projectRoot: string, summary: BatchSummary): Promise<void> {
    const dir = batchSummariesDir(projectRoot);
    await ensureDir(dir);
    const [from, to] = summary.chapterRange;
    const filePath = batchSummaryFilePath(projectRoot, from, to);
    await writeFile(filePath, JSON.stringify(summary, null, 2), 'utf-8');
    this.batchStore?.put(batchKey(from, to), JSON.stringify(summary)); // write-through
  }

  /** 读取多章综合总结 */
  async getBatchSummary(projectRoot: string, from: number, to: number): Promise<BatchSummary | null> {
    if (this.batchStore) {
      const cached = this.batchStore.get(batchKey(from, to));
      if (cached) return JSON.parse(cached) as BatchSummary;
    }
    const filePath = batchSummaryFilePath(projectRoot, from, to);
    try {
      const data = await readFile(filePath, 'utf-8');
      const summary = JSON.parse(data) as BatchSummary;
      this.batchStore?.put(batchKey(from, to), JSON.stringify(summary)); // 回填
      return summary;
    } catch {
      return null;
    }
  }

  /** 从文件列出所有综合总结(绕过缓存,按起始章节号排序) */
  private async listBatchSummariesFromFiles(projectRoot: string): Promise<BatchSummary[]> {
    const dir = batchSummariesDir(projectRoot);
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }
    const summaries: BatchSummary[] = [];
    for (const entry of entries) {
      if (!entry.startsWith('batch-') || !entry.endsWith('.json')) continue;
      try {
        const data = await readFile(`${dir}/${entry}`, 'utf-8');
        summaries.push(JSON.parse(data) as BatchSummary);
      } catch {
        // 跳过损坏文件
      }
    }
    return summaries.sort((a, b) => a.chapterRange[0] - b.chapterRange[0]);
  }

  /** 列出所有综合总结(按起始章节号排序) */
  async listBatchSummaries(projectRoot: string): Promise<BatchSummary[]> {
    if (this.batchStore) {
      const cached = this.batchStore.listValues();
      if (cached.length) {
        return cached
          .map((s) => JSON.parse(s) as BatchSummary)
          .sort((a, b) => a.chapterRange[0] - b.chapterRange[0]);
      }
    }
    const summaries = await this.listBatchSummariesFromFiles(projectRoot);
    if (this.batchStore && summaries.length) {
      this.batchStore.putMany(
        summaries.map((s) => ({
          key: batchKey(s.chapterRange[0], s.chapterRange[1]),
          value: JSON.stringify(s),
        })),
      );
    }
    return summaries;
  }

  /** 删除综合总结 */
  async deleteBatchSummary(projectRoot: string, from: number, to: number): Promise<boolean> {
    const filePath = batchSummaryFilePath(projectRoot, from, to);
    try {
      await unlink(filePath);
    } catch {
      return false;
    }
    this.batchStore?.delete(batchKey(from, to));
    return true;
  }

  /**
   * 从文件全量重建 summaries 缓存(chapter + batch)。
   * 用于缓存缺失 / 损坏 / 版本升级,或外部手改文件后同步。
   * 未注入 cache 时为空操作,返回 {0, 0}。
   */
  async rebuildSummariesCache(
    projectRoot: string,
  ): Promise<{ chapters: number; batches: number }> {
    if (!this.chapterStore || !this.batchStore) return { chapters: 0, batches: 0 };
    const chapters = await this.listChapterSummariesFromFiles(projectRoot);
    const batches = await this.listBatchSummariesFromFiles(projectRoot);
    this.chapterStore.clear();
    this.chapterStore.putMany(
      chapters.map((s) => ({ key: chapterKey(s.chapter), value: JSON.stringify(s) })),
    );
    this.batchStore.clear();
    this.batchStore.putMany(
      batches.map((s) => ({
        key: batchKey(s.chapterRange[0], s.chapterRange[1]),
        value: JSON.stringify(s),
      })),
    );
    return { chapters: chapters.length, batches: batches.length };
  }

  /**
   * 从文件全量重建 curation + action-log 缓存。
   * 用于缓存缺失 / 损坏 / 版本升级,或外部手改文件后同步。未注入 cache 时为空操作。
   */
  async rebuildLogsCache(
    projectRoot: string,
  ): Promise<{ curations: number; logs: number }> {
    if (!this.curationStore || !this.actionLogStore) return { curations: 0, logs: 0 };
    // curation
    let cData: CurationSuggestions | null = null;
    try {
      const raw = await readFile(curationSuggestionsFilePath(projectRoot), 'utf-8');
      cData = JSON.parse(raw) as CurationSuggestions;
    } catch {
      cData = null;
    }
    this.curationStore.clear();
    if (cData) {
      this.curationStore.putMany(
        cData.suggestions.map((s) => ({ key: curationKey(s.chapter), value: JSON.stringify(s) })),
      );
      this.curationStore.put(CURATION_META_KEY, cData.updatedAt);
    }
    // action-log
    const log = await this.getActionLogFromFiles(projectRoot);
    this.actionLogStore.clear();
    if (log) {
      this.actionLogStore.putMany(
        log.entries.map((e, i) => ({ key: logKey(i + 1), value: JSON.stringify(e) })),
      );
    }
    return { curations: cData?.suggestions.length ?? 0, logs: log?.entries.length ?? 0 };
  }

  // ── StoryStateSnapshot（单文件,不缓存） ──

  /** 保存剧情状态快照(覆盖写入) */
  async saveStoryState(projectRoot: string, state: StoryStateSnapshot): Promise<void> {
    await ensureDir(memoryDir(projectRoot));
    await writeFile(storyStateFilePath(projectRoot), JSON.stringify(state, null, 2), 'utf-8');
  }

  /** 读取剧情状态快照 */
  async getStoryState(projectRoot: string): Promise<StoryStateSnapshot | null> {
    try {
      const data = await readFile(storyStateFilePath(projectRoot), 'utf-8');
      return JSON.parse(data) as StoryStateSnapshot;
    } catch {
      return null;
    }
  }

  // ── CharacterStates（从 ChapterSummary 派生） ──

  /**
   * 重建角色状态变迁:读全部章节摘要 → 聚合 → 覆盖写入,返回结果。
   * 供发布流程在章节摘要生成后调用;数据源为已入库的 ChapterSummary,不调 LLM。
   */
  async rebuildCharacterStates(projectRoot: string): Promise<CharacterStates> {
    const summaries = await this.listChapterSummaries(projectRoot); // 走缓存(若有)
    const characterStates = aggregateCharacterStates(summaries);
    await this.saveCharacterStates(projectRoot, characterStates);
    return characterStates;
  }

  /** 保存角色状态变迁(覆盖写入) */
  async saveCharacterStates(projectRoot: string, states: CharacterStates): Promise<void> {
    await ensureDir(memoryDir(projectRoot));
    await writeFile(characterStatesFilePath(projectRoot), JSON.stringify(states, null, 2), 'utf-8');
  }

  /** 读取角色状态变迁 */
  async getCharacterStates(projectRoot: string): Promise<CharacterStates | null> {
    try {
      const data = await readFile(characterStatesFilePath(projectRoot), 'utf-8');
      return JSON.parse(data) as CharacterStates;
    } catch {
      return null;
    }
  }

  // ── CurationSuggestions（Curator 提取的实体建议,待人工确认;S04 迁缓存） ──

  /** 保存全部 curation 建议(覆盖写入文件 + 同步缓存) */
  async saveCurationSuggestions(projectRoot: string, suggestions: CurationSuggestions): Promise<void> {
    await ensureDir(memoryDir(projectRoot));
    await writeFile(curationSuggestionsFilePath(projectRoot), JSON.stringify(suggestions, null, 2), 'utf-8');
    if (this.curationStore) {
      this.curationStore.clear();
      this.curationStore.putMany(
        suggestions.suggestions.map((s) => ({ key: curationKey(s.chapter), value: JSON.stringify(s) })),
      );
      this.curationStore.put(CURATION_META_KEY, suggestions.updatedAt);
    }
  }

  /** 读取全部 curation 建议(缓存优先,缺失降级文件) */
  async getCurationSuggestions(projectRoot: string): Promise<CurationSuggestions | null> {
    if (this.curationStore) {
      const meta = this.curationStore.get(CURATION_META_KEY);
      const docs = this.curationStore.list().filter((d) => d.key !== CURATION_META_KEY);
      if (meta !== null || docs.length) {
        const suggestions = docs
          .map((d) => JSON.parse(d.value) as CurationSuggestion)
          .sort((a, b) => a.chapter - b.chapter);
        return {
          suggestions,
          updatedAt: meta ?? suggestions[suggestions.length - 1]?.createdAt ?? new Date().toISOString(),
        };
      }
    }
    try {
      const data = await readFile(curationSuggestionsFilePath(projectRoot), 'utf-8');
      return JSON.parse(data) as CurationSuggestions;
    } catch {
      return null;
    }
  }

  /** 移除某条 curation 建议(确认入库或忽略后调用) */
  async removeCurationEntity(
    projectRoot: string,
    chapter: number,
    type: 'characters' | 'hooks' | 'worldEntries',
    name: string,
  ): Promise<void> {
    const data = await this.getCurationSuggestions(projectRoot);
    if (!data) return;
    let changed = false;
    for (const s of data.suggestions) {
      if (s.chapter !== chapter) continue;
      if (type === 'characters') {
        const before = s.characters.length;
        s.characters = s.characters.filter((e) => e.name !== name);
        if (s.characters.length !== before) changed = true;
      } else if (type === 'hooks') {
        const before = s.hooks.length;
        s.hooks = s.hooks.filter((e) => e.name !== name);
        if (s.hooks.length !== before) changed = true;
      } else {
        const before = s.worldEntries.length;
        s.worldEntries = s.worldEntries.filter((e) => e.name !== name);
        if (s.worldEntries.length !== before) changed = true;
      }
    }
    if (changed) {
      data.suggestions = data.suggestions.filter(
        (s) => s.characters.length || s.hooks.length || s.worldEntries.length,
      );
      await this.saveCurationSuggestions(projectRoot, data);
    }
  }

  // ── ActionLog（操作日志:伏笔状态变更、实体建议加入/放弃,均留痕;S04 迁缓存） ──

  /** 追加一条操作日志(自动加 at 时间戳;缓存 O(1) 追加 + 文件主存储同步) */
  async appendActionLog(projectRoot: string, entry: Omit<ActionLogEntry, 'at'>): Promise<void> {
    const full: ActionLogEntry = { ...entry, at: new Date().toISOString() };
    if (this.actionLogStore) {
      const seq = this.actionLogStore.count() + 1;
      this.actionLogStore.put(logKey(seq), JSON.stringify(full));
    }
    const log = await this.getActionLogFromFiles(projectRoot);
    const entries = log?.entries ?? [];
    entries.push(full);
    await ensureDir(memoryDir(projectRoot));
    await writeFile(actionLogFilePath(projectRoot), JSON.stringify({ entries }, null, 2), 'utf-8');
  }

  /** 读取操作日志(缓存优先,缺失降级文件) */
  async getActionLog(projectRoot: string): Promise<ActionLog | null> {
    if (this.actionLogStore) {
      const vals = this.actionLogStore.listValues();
      if (vals.length) {
        return { entries: vals.map((v) => JSON.parse(v) as ActionLogEntry) };
      }
    }
    return this.getActionLogFromFiles(projectRoot);
  }

  /** 从文件读操作日志(绕过缓存) */
  private async getActionLogFromFiles(projectRoot: string): Promise<ActionLog | null> {
    try {
      const data = await readFile(actionLogFilePath(projectRoot), 'utf-8');
      return JSON.parse(data) as ActionLog;
    } catch {
      return null;
    }
  }
}
