import type { ChapterService } from './chapter-service.js';

export interface BookStats {
  chapters: { total: number; draft: number; approved: number; published: number };
  /** 已发布章节总字数(仅统计 published,正文去 HTML) */
  totalWords: number;
  /** 已发布章节平均字数 */
  avgWords: number;
  /** 已发布章节最长字数 */
  maxWords: number;
  /** 已发布章节最短字数 */
  minWords: number;
  /** 最近一次章节更新时间(ISO,含 draft 写作活动),无章节则 null */
  lastUpdatedAt: string | null;
}

/**
 * 数据统计服务(G05-S06)
 *
 * 章节状态分布统计所有章节;字数指标(总/平均/最长/最短)只统计已发布章节,
 * 避免草稿空章拉低统计;lastUpdatedAt 反映最近写作活动(含 draft)。
 */
export class StatsService {
  constructor(private readonly chapterService: ChapterService) {}

  async getStats(): Promise<BookStats> {
    const metas = await this.chapterService.list();
    const status = { draft: 0, approved: 0, published: 0 };
    let pubWords = 0;
    let pubMax = 0;
    let pubMin = Number.POSITIVE_INFINITY;
    let pubCount = 0;
    let lastUpdatedAt: string | null = null;
    for (const m of metas) {
      if (m.status === 'approved') status.approved++;
      else if (m.status === 'published') status.published++;
      else status.draft++;
      // 最近写作活动(所有章节)
      if (m.updatedAt && (lastUpdatedAt === null || m.updatedAt > lastUpdatedAt)) {
        lastUpdatedAt = m.updatedAt;
      }
      // 字数仅统计已发布章节
      if (m.status !== 'published') continue;
      pubCount++;
      const vol = await this.chapterService.findVolume(m.id);
      if (vol == null) continue;
      const ch = await this.chapterService.read(vol, m.id);
      if (!ch) continue;
      const wc = ch.content.replace(/<[^>]+>/g, '').length;
      pubWords += wc;
      if (wc > pubMax) pubMax = wc;
      if (wc < pubMin) pubMin = wc;
    }
    return {
      chapters: { total: metas.length, ...status },
      totalWords: pubWords,
      avgWords: pubCount ? Math.round(pubWords / pubCount) : 0,
      maxWords: pubCount ? pubMax : 0,
      minWords: pubCount ? pubMin : 0,
      lastUpdatedAt,
    };
  }
}
