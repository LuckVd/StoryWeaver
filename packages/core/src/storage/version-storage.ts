import { readFile, writeFile, readdir, rm, unlink } from 'node:fs/promises';
import { ensureDir, chapterVersionsDir, versionFilePath, parseVersionId } from './path.js';
import type { ChapterVersion, VersionTrigger } from '../models/chapter.js';

/**
 * 章节版本存储
 *
 * 管理章节版本快照的 CRUD。版本存储在 volumes/vXX/chXXX.versions/ 目录下，
 * 每个版本为一个 JSON 文件（v001.json, v002.json, ...）。
 *
 * 规则：
 * - 每章最多 MAX_VERSIONS 个版本
 * - 超出时自动删除最旧版本
 * - published 时清空所有版本
 */

const MAX_VERSIONS = 100;

export class VersionStorage {
  /** 每章一个写锁，保证快照写入串行（避免并发 list→+1→write 算出相同 nextId 互相覆盖） */
  private locks = new Map<string, Promise<unknown>>();

  /** 串行化执行同一 key 的异步任务（promise-chain 锁） */
  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    // 存一个不会 reject 的完成信号供后续任务 await（每章固定一个 entry，不会无限增长）
    this.locks.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  /**
   * 列出章节所有版本（按版本号倒序）
   */
  async list(projectRoot: string, volume: number, chapterId: number): Promise<ChapterVersion[]> {
    const dir = chapterVersionsDir(projectRoot, volume, chapterId);
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }

    const versions: ChapterVersion[] = [];
    for (const entry of entries) {
      const vid = parseVersionId(entry);
      if (vid === null) continue;
      const version = await this.read(projectRoot, volume, chapterId, vid);
      if (version) versions.push(version);
    }

    return versions.sort((a, b) => b.id - a.id);
  }

  /**
   * 读取单个版本
   */
  async read(projectRoot: string, volume: number, chapterId: number, versionId: number): Promise<ChapterVersion | null> {
    const filePath = versionFilePath(projectRoot, volume, chapterId, versionId);
    try {
      const data = await readFile(filePath, 'utf-8');
      return JSON.parse(data) as ChapterVersion;
    } catch {
      return null;
    }
  }

  /**
   * 创建版本快照（自增 ID）
   *
   * 同一章的快照写入经 per-chapter 锁串行化，避免并发触发（如 AI apply + 自动保存）
   * 时各自 list→+1→write 算出相同 nextId 互相覆盖。
   */
  async write(
    projectRoot: string,
    volume: number,
    chapterId: number,
    input: { content: string; trigger: VersionTrigger; description?: string },
  ): Promise<ChapterVersion> {
    return this.withLock(`${volume}:${chapterId}`, async () => {
      const dir = chapterVersionsDir(projectRoot, volume, chapterId);
      await ensureDir(dir);

      // 确定下一个版本 ID
      const existing = await this.list(projectRoot, volume, chapterId);
      const nextId = existing.length > 0 ? existing[0].id + 1 : 1;

      const version: ChapterVersion = {
        id: nextId,
        chapterId,
        content: input.content,
        trigger: input.trigger,
        description: input.description,
        wordCount: input.content.length,
        createdAt: new Date().toISOString(),
      };

      const filePath = versionFilePath(projectRoot, volume, chapterId, nextId);
      await writeFile(filePath, JSON.stringify(version, null, 2), 'utf-8');

      // 自动清理超出限制的版本
      await this.pruneOld(projectRoot, volume, chapterId, MAX_VERSIONS);

      return version;
    });
  }

  /**
   * 删除指定版本
   */
  async delete(projectRoot: string, volume: number, chapterId: number, versionId: number): Promise<boolean> {
    const filePath = versionFilePath(projectRoot, volume, chapterId, versionId);
    try {
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 清空章节所有版本（published 时调用）
   */
  async purgeAll(projectRoot: string, volume: number, chapterId: number): Promise<void> {
    const dir = chapterVersionsDir(projectRoot, volume, chapterId);
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // 目录不存在时忽略
    }
  }

  /**
   * 保留最新的 maxVersions 个版本，删除其余
   */
  async pruneOld(projectRoot: string, volume: number, chapterId: number, maxVersions: number): Promise<void> {
    const versions = await this.list(projectRoot, volume, chapterId);
    if (versions.length <= maxVersions) return;

    const toDelete = versions.slice(maxVersions);
    for (const v of toDelete) {
      await this.delete(projectRoot, volume, chapterId, v.id);
    }
  }
}
