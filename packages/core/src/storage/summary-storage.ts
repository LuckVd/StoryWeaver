import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { ensureDir, summariesDir, summaryFilePath, batchSummariesDir, batchSummaryFilePath, storyStateFilePath } from './path.js';
import type { ChapterSummary, BatchSummary, StoryStateSnapshot } from '../models/memory.js';

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
    const filePath = storyStateFilePath(projectRoot);
    await ensureDir(filePath.substring(0, filePath.lastIndexOf('/')));
    await writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
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
}
