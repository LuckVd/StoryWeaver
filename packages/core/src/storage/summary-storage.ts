import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { ensureDir, memoryDir, summariesDir, summaryFilePath, batchSummariesDir, batchSummaryFilePath, storyStateFilePath, timelineFilePath, characterStatesFilePath, curationSuggestionsFilePath } from './path.js';
import type { ChapterSummary, BatchSummary, StoryStateSnapshot, Timeline, CharacterStates, CurationSuggestions } from '../models/memory.js';
import { aggregateTimeline, aggregateCharacterStates } from '../memory/aggregator.js';

/**
 * 摘要存储层
 *
 * 管理 AI 生成的结构化记忆：
 * - ChapterSummary — 每章摘要（memory/summaries/chXXX.json）
 * - BatchSummary — 多章综合总结（memory/batch-summaries/batch-XXX-XXX.json）
 * - StoryStateSnapshot — 剧情状态快照（memory/story-state.json）
 */
export class SummaryStorage {
  // ── ChapterSummary ──

  /** 保存章节摘要（覆盖写入） */
  async saveChapterSummary(projectRoot: string, summary: ChapterSummary): Promise<void> {
    const dir = summariesDir(projectRoot);
    await ensureDir(dir);
    const filePath = summaryFilePath(projectRoot, summary.chapter);
    await writeFile(filePath, JSON.stringify(summary, null, 2), 'utf-8');
  }

  /** 读取单章摘要 */
  async getChapterSummary(projectRoot: string, chapter: number): Promise<ChapterSummary | null> {
    const filePath = summaryFilePath(projectRoot, chapter);
    try {
      const data = await readFile(filePath, 'utf-8');
      return JSON.parse(data) as ChapterSummary;
    } catch {
      return null;
    }
  }

  /** 列出所有章节摘要（按章节号排序） */
  async listChapterSummaries(projectRoot: string): Promise<ChapterSummary[]> {
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

  /** 删除单章摘要 */
  async deleteChapterSummary(projectRoot: string, chapter: number): Promise<boolean> {
    const filePath = summaryFilePath(projectRoot, chapter);
    try {
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // ── BatchSummary ──

  /** 保存多章综合总结（覆盖写入） */
  async saveBatchSummary(projectRoot: string, summary: BatchSummary): Promise<void> {
    const dir = batchSummariesDir(projectRoot);
    await ensureDir(dir);
    const [from, to] = summary.chapterRange;
    const filePath = batchSummaryFilePath(projectRoot, from, to);
    await writeFile(filePath, JSON.stringify(summary, null, 2), 'utf-8');
  }

  /** 读取多章综合总结 */
  async getBatchSummary(projectRoot: string, from: number, to: number): Promise<BatchSummary | null> {
    const filePath = batchSummaryFilePath(projectRoot, from, to);
    try {
      const data = await readFile(filePath, 'utf-8');
      return JSON.parse(data) as BatchSummary;
    } catch {
      return null;
    }
  }

  /** 列出所有综合总结（按起始章节号排序） */
  async listBatchSummaries(projectRoot: string): Promise<BatchSummary[]> {
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

  /** 删除综合总结 */
  async deleteBatchSummary(projectRoot: string, from: number, to: number): Promise<boolean> {
    const filePath = batchSummaryFilePath(projectRoot, from, to);
    try {
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // ── StoryStateSnapshot ──

  /** 保存剧情状态快照（覆盖写入） */
  async saveStoryState(projectRoot: string, state: StoryStateSnapshot): Promise<void> {
    await ensureDir(memoryDir(projectRoot));
    await writeFile(storyStateFilePath(projectRoot), JSON.stringify(state, null, 2), 'utf-8');
  }

  /** 读取剧情状态快照 */
  async getStoryState(projectRoot: string): Promise<StoryStateSnapshot | null> {
    const filePath = storyStateFilePath(projectRoot);
    try {
      const data = await readFile(filePath, 'utf-8');
      return JSON.parse(data) as StoryStateSnapshot;
    } catch {
      return null;
    }
  }

  // ── Timeline & CharacterStates（从 ChapterSummary 派生） ──

  /**
   * 重建时间线 + 角色状态变迁：读全部章节摘要 → 聚合 → 覆盖写入，返回两者。
   * 供发布流程在章节摘要生成后调用；数据源为已入库的 ChapterSummary，不调 LLM。
   */
  async rebuildTimelineAndCharacterStates(projectRoot: string): Promise<{
    timeline: Timeline;
    characterStates: CharacterStates;
  }> {
    const summaries = await this.listChapterSummaries(projectRoot);
    const timeline = aggregateTimeline(summaries);
    const characterStates = aggregateCharacterStates(summaries);
    await this.saveTimeline(projectRoot, timeline);
    await this.saveCharacterStates(projectRoot, characterStates);
    return { timeline, characterStates };
  }

  /** 保存时间线（覆盖写入） */
  async saveTimeline(projectRoot: string, timeline: Timeline): Promise<void> {
    await ensureDir(memoryDir(projectRoot));
    await writeFile(timelineFilePath(projectRoot), JSON.stringify(timeline, null, 2), 'utf-8');
  }

  /** 读取时间线 */
  async getTimeline(projectRoot: string): Promise<Timeline | null> {
    try {
      const data = await readFile(timelineFilePath(projectRoot), 'utf-8');
      return JSON.parse(data) as Timeline;
    } catch {
      return null;
    }
  }

  /** 保存角色状态变迁（覆盖写入） */
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

  // ── CurationSuggestions（Curator 提取的实体建议，待人工确认） ──

  /** 保存全部 curation 建议（覆盖写入） */
  async saveCurationSuggestions(projectRoot: string, suggestions: CurationSuggestions): Promise<void> {
    await ensureDir(memoryDir(projectRoot));
    await writeFile(curationSuggestionsFilePath(projectRoot), JSON.stringify(suggestions, null, 2), 'utf-8');
  }

  /** 读取全部 curation 建议 */
  async getCurationSuggestions(projectRoot: string): Promise<CurationSuggestions | null> {
    try {
      const data = await readFile(curationSuggestionsFilePath(projectRoot), 'utf-8');
      return JSON.parse(data) as CurationSuggestions;
    } catch {
      return null;
    }
  }

  /** 移除某条 curation 建议（确认入库或忽略后调用） */
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
}
