import { ChapterStorage, VolumeIndexStorage, VersionStorage, type ChapterMeta, type Chapter, type ChapterStatus, type VersionTrigger } from '@storyweaver/core';

/**
 * 章节业务逻辑层
 *
 * 封装章节 CRUD + 状态流转，协调 VolumeIndexStorage（元数据）和 ChapterStorage（内容）。
 */
export class ChapterService {
  constructor(
    private readonly indexStorage: VolumeIndexStorage,
    private readonly chapterStorage: ChapterStorage,
    private readonly versionStorage: VersionStorage,
    private readonly projectRoot: string,
  ) {}

  /** 列出章节元信息（可选按卷过滤） */
  async list(volume?: number): Promise<ChapterMeta[]> {
    if (volume !== undefined) {
      return this.indexStorage.read(volume);
    }
    // 无过滤时：遍历所有卷
    const volumeIds = await this.chapterStorage.listVolumes();
    const all: ChapterMeta[] = [];
    for (const v of volumeIds) {
      all.push(...await this.indexStorage.read(v));
    }
    return all;
  }

  /** 创建章节（写 .md + 写 index.json） */
  async create(volume: number, chapterId: number, title: string): Promise<ChapterMeta> {
    const now = new Date().toISOString();
    const meta: ChapterMeta = {
      id: chapterId,
      title,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    // 写入空内容 .md
    await this.chapterStorage.writeChapter(volume, chapterId, '');
    // 追加到卷索引
    const chapters = await this.indexStorage.read(volume);
    chapters.push(meta);
    await this.indexStorage.write(volume, chapters);
    return meta;
  }

  /** 获取章节完整视图（元信息 + 内容） */
  async read(volume: number, chapterId: number): Promise<Chapter | null> {
    const meta = await this.indexStorage.readChapter(volume, chapterId);
    if (!meta) {
      return null;
    }
    const content = await this.chapterStorage.readChapter(volume, chapterId);
    return { ...meta, volume, content: content ?? '' };
  }

  /** 更新章节标题/内容（published 不可修改） */
  async update(volume: number, chapterId: number, patch: { title?: string; content?: string }, trigger?: VersionTrigger): Promise<Chapter | null> {
    const meta = await this.indexStorage.readChapter(volume, chapterId);
    if (!meta) {
      return null;
    }
    if (meta.status === 'published') {
      throw new Error('CHAPTER_LOCKED');
    }
    // 更新前创建版本快照（仅内容变更时）
    if (patch.content !== undefined) {
      const current = await this.chapterStorage.readChapter(volume, chapterId);
      if (current !== null && current !== patch.content) {
        await this.createSnapshot(volume, chapterId, current, trigger ?? 'save');
      }
    }
    const now = new Date().toISOString();
    const metaPatch: Partial<ChapterMeta> = { updatedAt: now };
    if (patch.title !== undefined) {
      metaPatch.title = patch.title;
    }
    await this.indexStorage.updateChapter(volume, chapterId, metaPatch);
    if (patch.content !== undefined) {
      await this.chapterStorage.writeChapter(volume, chapterId, patch.content);
    }
    return this.read(volume, chapterId);
  }

  /** 删除章节（仅 draft 状态） */
  async delete(volume: number, chapterId: number): Promise<boolean> {
    const meta = await this.indexStorage.readChapter(volume, chapterId);
    if (!meta) {
      return false;
    }
    if (meta.status !== 'draft') {
      throw new Error('CHAPTER_LOCKED');
    }
    await this.chapterStorage.deleteChapter(volume, chapterId);
    await this.indexStorage.deleteChapter(volume, chapterId);
    return true;
  }

  /** 章节状态流转：draft → approved → published（不可逆） */
  async updateStatus(volume: number, chapterId: number, newStatus: ChapterStatus): Promise<ChapterMeta | null> {
    const meta = await this.indexStorage.readChapter(volume, chapterId);
    if (!meta) {
      return null;
    }
    // 校验流转合法性
    const flow: Record<ChapterStatus, ChapterStatus | null> = {
      draft: 'approved',
      approved: 'published',
      published: null,
    };
    const expected = flow[meta.status];
    if (expected !== newStatus) {
      throw new Error('INVALID_STATUS_TRANSITION');
    }
    // 状态变更前创建快照
    const content = await this.chapterStorage.readChapter(volume, chapterId);
    if (content !== null) {
      await this.createSnapshot(volume, chapterId, content, 'status_change', `状态变更为 ${newStatus}`);
    }
    const now = new Date().toISOString();
    const patch: Partial<ChapterMeta> = {
      status: newStatus,
      updatedAt: now,
    };
    if (newStatus === 'published') {
      patch.publishedAt = now;
    }
    await this.indexStorage.updateChapter(volume, chapterId, patch);
    // published 时清空版本历史
    if (newStatus === 'published') {
      await this.versionStorage.purgeAll(this.projectRoot, volume, chapterId);
    }
    return { ...meta, ...patch };
  }

  /** 查找章节所在卷号（通过扫描所有卷索引） */
  async findVolume(chapterId: number): Promise<number | null> {
    const volumeIds = await this.chapterStorage.listVolumes();
    for (const v of volumeIds) {
      const chapters = await this.indexStorage.read(v);
      if (chapters.some((c) => c.id === chapterId)) {
        return v;
      }
    }
    return null;
  }

  /** 创建版本快照 */
  async createSnapshot(volume: number, chapterId: number, content: string, trigger: VersionTrigger, description?: string): Promise<void> {
    await this.versionStorage.write(this.projectRoot, volume, chapterId, { content, trigger, description });
  }

  /** 列出章节版本历史 */
  async listVersions(volume: number, chapterId: number) {
    return this.versionStorage.list(this.projectRoot, volume, chapterId);
  }

  /** 读取指定版本 */
  async readVersion(volume: number, chapterId: number, versionId: number) {
    return this.versionStorage.read(this.projectRoot, volume, chapterId, versionId);
  }

  /** 恢复到指定版本 */
  async restoreVersion(volume: number, chapterId: number, versionId: number): Promise<Chapter | null> {
    const version = await this.versionStorage.read(this.projectRoot, volume, chapterId, versionId);
    if (!version) {
      return null;
    }
    return this.update(volume, chapterId, { content: version.content }, 'save');
  }
}
