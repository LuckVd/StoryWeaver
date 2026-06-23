import type { ChapterService } from './chapter-service.js';

export type ExportFormat = 'txt' | 'md';

/**
 * 导出服务(G05-S05)
 *
 * 将全书章节导出为 TXT / Markdown(章节按 id 排序,正文去 HTML 标签)。
 * EPUB 需额外依赖(epub-gen-memory),暂未实现,留作后续。
 */
export class ExportService {
  constructor(private readonly chapterService: ChapterService) {}

  async exportBook(
    format: ExportFormat,
  ): Promise<{ filename: string; content: string; mime: string }> {
    const metas = (await this.chapterService.list()).slice().sort((a, b) => a.id - b.id);
    const parts: string[] = [];
    for (const m of metas) {
      const vol = await this.chapterService.findVolume(m.id);
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

  private stripHtml(html: string): string {
    // 去 HTML 标签 + 合并多余空白
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
