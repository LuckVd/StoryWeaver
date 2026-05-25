import { readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolveSafe, chapterPath, volumeDir, ensureDir, parseVolumeNumber, parseChapterId } from './path.js';

/**
 * Chapter 存储层 — 章节正文 .md 文件 CRUD
 *
 * 文件布局：volumes/vXX/chXXX.md
 */
export class ChapterStorage {
  constructor(private readonly projectRoot: string) {}

  /** 读取章节内容，不存在返回 null */
  async readChapter(volume: number, chapterId: number): Promise<string | null> {
    const filePath = chapterPath(this.projectRoot, volume, chapterId);
    if (!existsSync(filePath)) {
      return null;
    }
    return readFile(filePath, 'utf-8');
  }

  /** 写入章节内容，目录不存在自动创建 */
  async writeChapter(volume: number, chapterId: number, content: string): Promise<void> {
    const dir = volumeDir(this.projectRoot, volume);
    await ensureDir(dir);
    const filePath = chapterPath(this.projectRoot, volume, chapterId);
    await writeFile(filePath, content, 'utf-8');
  }

  /** 删除章节文件，返回是否实际删除 */
  async deleteChapter(volume: number, chapterId: number): Promise<boolean> {
    const filePath = chapterPath(this.projectRoot, volume, chapterId);
    if (!existsSync(filePath)) {
      return false;
    }
    await unlink(filePath);
    return true;
  }

  /** 列出某卷所有章节 ID（升序） */
  async listChapters(volume: number): Promise<number[]> {
    const dir = volumeDir(this.projectRoot, volume);
    if (!existsSync(dir)) {
      return [];
    }
    const entries = await readdir(dir);
    const ids: number[] = [];
    for (const name of entries) {
      const id = parseChapterId(name);
      if (id !== null) {
        ids.push(id);
      }
    }
    return ids.sort((a, b) => a - b);
  }

  /** 列出所有卷号（升序） */
  async listVolumes(): Promise<number[]> {
    const volumesDir = resolveSafe(this.projectRoot, 'volumes');
    if (!existsSync(volumesDir)) {
      return [];
    }
    const entries = await readdir(volumesDir, { withFileTypes: true });
    const ids: number[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const num = parseVolumeNumber(entry.name);
        if (num !== null) {
          ids.push(num);
        }
      }
    }
    return ids.sort((a, b) => a - b);
  }
}
