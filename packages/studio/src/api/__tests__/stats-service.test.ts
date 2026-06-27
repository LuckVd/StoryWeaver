import { describe, it, expect } from 'vitest';
import { StatsService } from '../services/stats-service.js';
import type { ChapterService } from '../services/chapter-service.js';
import type { ChapterMeta, Chapter } from '@storyweaver/core';

function mock(cs: { id: number; status: string; title: string; content: string }[]): ChapterService {
  const metaOf = (c: { id: number; status: string; title: string }): ChapterMeta => ({
    id: c.id,
    title: c.title,
    status: c.status as ChapterMeta['status'],
    createdAt: '',
    updatedAt: '',
  });
  return {
    list: async () => cs.map(metaOf),
    findVolume: async () => 1,
    read: async (_v: number, id: number): Promise<Chapter | null> => {
      const c = cs.find((x) => x.id === id);
      if (!c) return null;
      return { ...metaOf(c), volume: 1, content: c.content };
    },
  } as unknown as ChapterService;
}

describe('StatsService (G05-S06)', () => {
  it('聚合章节数 / 状态分布 / 总字数(去 HTML)', async () => {
    const svc = new StatsService(
      mock([
        { id: 1, status: 'draft', title: 'a', content: '<p>十二</p>' }, // 2 字
        { id: 2, status: 'published', title: 'b', content: '三四五' }, // 3 字
        { id: 3, status: 'approved', title: 'c', content: '六' }, // 1 字
      ]),
    );
    const s = await svc.getStats();
    expect(s.chapters.total).toBe(3);
    expect(s.chapters.draft).toBe(1);
    expect(s.chapters.approved).toBe(1);
    expect(s.chapters.published).toBe(1);
    expect(s.totalWords).toBe(3); // 字数仅统计已发布(id2: 三四五 = 3 字)
    expect(s.avgWords).toBe(3);
    expect(s.maxWords).toBe(3);
    expect(s.minWords).toBe(3);
  });

  it('无章节返回 0', async () => {
    const svc = new StatsService(mock([]));
    const s = await svc.getStats();
    expect(s.chapters.total).toBe(0);
    expect(s.totalWords).toBe(0);
    expect(s.avgWords).toBe(0);
    expect(s.maxWords).toBe(0);
    expect(s.minWords).toBe(0);
  });
});
