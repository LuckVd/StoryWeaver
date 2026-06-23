import type { ChapterService } from './chapter-service.js';

export interface BookStats {
  chapters: { total: number; draft: number; approved: number; published: number };
  totalWords: number;
}

/**
 * 数据统计服务(G05-S06)
 *
 * 聚合全书章节状态分布与总字数(正文去 HTML 标签),供统计看板展示。
 */
export class StatsService {
  constructor(private readonly chapterService: ChapterService) {}

  async getStats(): Promise<BookStats> {
    const metas = await this.chapterService.list();
    const status = { draft: 0, approved: 0, published: 0 };
    let totalWords = 0;
    for (const m of metas) {
      if (m.status === 'approved') status.approved++;
      else if (m.status === 'published') status.published++;
      else status.draft++;
      const vol = await this.chapterService.findVolume(m.id);
      if (vol != null) {
        const ch = await this.chapterService.read(vol, m.id);
        if (ch) totalWords += ch.content.replace(/<[^>]+>/g, '').length;
      }
    }
    return { chapters: { total: metas.length, ...status }, totalWords };
  }
}
