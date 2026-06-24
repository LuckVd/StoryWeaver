import type { ChapterService } from './chapter-service.js';
import { toPlainText } from '../../lib/md-utils.js';

export type ExportFormat = 'txt' | 'md';

/**
 * 导出服务(G05-S05)
 *
 * 将全书「已发布」章节导出为 TXT / Markdown，按 卷→章 二级排序，正文去 HTML 标签。
 * 仅导出 published 章节（draft/approved 不导出），符合「定稿发布即成书」的语义。
 * EPUB 需额外依赖(epub-gen-memory),暂未实现,留作后续。
 */
export class ExportService {
  constructor(private readonly chapterService: ChapterService) {}

  async exportBook(
    format: ExportFormat,
  ): Promise<{ filename: string; content: string; mime: string }> {
    const metas = (await this.chapterService.list()).filter((m) => m.status === 'published');
    // 解析每章所在卷并按 卷→章 二级排序（跨卷按卷号升序，卷内按章节号升序）
    const withVol = await Promise.all(
      metas.map(async (m) => ({ m, vol: await this.chapterService.findVolume(m.id) })),
    );
    withVol.sort((a, b) => (a.vol ?? 0) - (b.vol ?? 0) || a.m.id - b.m.id);

    const parts: string[] = [];
    for (const { m, vol } of withVol) {
      if (vol == null) continue;
      const ch = await this.chapterService.read(vol, m.id);
      if (!ch) continue;
      const text = this.stripHtml(ch.content);
      if (format === 'md') {
        parts.push(`# 第${m.id}章 ${m.title}\n\n${text}\n`);
      } else {
        parts.push(`第${m.id}章 ${m.title}\n\n${text}\n`);
      }
    }
    const body = parts.join('\n').trim();
    return {
      filename: `export.${format === 'md' ? 'md' : 'txt'}`,
      content: body,
      mime: format === 'md' ? 'text/markdown' : 'text/plain',
    };
  }

  private stripHtml(content: string): string {
    // 去 HTML/Markdown 标记（兼容旧 HTML 与新 Markdown 存储）
    return toPlainText(content);
  }
}
