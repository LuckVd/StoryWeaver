import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { ChapterMeta } from '../models/index.js';
import { volumeIndexPath, ensureDir } from './path.js';

/**
 * 卷索引 — volumes/vXX/index.json 读写
 *
 * 每卷一个 JSON 文件，存储该卷的章节元数据列表。
 */
export class VolumeIndexStorage {
  constructor(private readonly projectRoot: string) {}

  private filePath(volume: number): string {
    return volumeIndexPath(this.projectRoot, volume);
  }

  /** 读取卷索引，不存在返回空数组 */
  async read(volume: number): Promise<ChapterMeta[]> {
    const fp = this.filePath(volume);
    if (!existsSync(fp)) {
      return [];
    }
    const raw = await readFile(fp, 'utf-8');
    return JSON.parse(raw) as ChapterMeta[];
  }

  /** 写入卷索引，目录不存在自动创建 */
  async write(volume: number, chapters: ChapterMeta[]): Promise<void> {
    const dir = this.filePath(volume);
    const dirPath = dir.replace(/\/index\.json$/, '');
    await ensureDir(dirPath);
    await writeFile(dir, JSON.stringify(chapters, null, 2), 'utf-8');
  }

  /** 获取单个章节元信息，不存在返回 null */
  async readChapter(volume: number, chapterId: number): Promise<ChapterMeta | null> {
    const chapters = await this.read(volume);
    return chapters.find((c) => c.id === chapterId) ?? null;
  }

  /** 更新单个章节元信息，不存在返回 false */
  async updateChapter(volume: number, chapterId: number, patch: Partial<ChapterMeta>): Promise<boolean> {
    const chapters = await this.read(volume);
    const idx = chapters.findIndex((c) => c.id === chapterId);
    if (idx === -1) {
      return false;
    }
    chapters[idx] = { ...chapters[idx], ...patch };
    await this.write(volume, chapters);
    return true;
  }

  /** 删除单个章节元信息，返回是否实际删除 */
  async deleteChapter(volume: number, chapterId: number): Promise<boolean> {
    const chapters = await this.read(volume);
    const idx = chapters.findIndex((c) => c.id === chapterId);
    if (idx === -1) {
      return false;
    }
    chapters.splice(idx, 1);
    await this.write(volume, chapters);
    return true;
  }
}
