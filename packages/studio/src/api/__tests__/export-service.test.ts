import { describe, it, expect } from 'vitest';
import { ExportService } from '../services/export-service.js';
import type { ChapterService } from '../services/chapter-service.js';
import type { ChapterMeta, Chapter } from '@storyweaver/core';

interface MockChapter {
  id: number;
  title: string;
  content: string;
  status?: 'draft' | 'approved' | 'published';
  volume?: number;
}

function mockChapterService(chapters: MockChapter[]): ChapterService {
  const metaOf = (c: MockChapter): ChapterMeta => ({
    id: c.id,
    title: c.title,
    status: c.status ?? 'published',
    createdAt: '',
    updatedAt: '',
  });
  return {
    list: async () => chapters.map(metaOf),
    findVolume: async (id: number) => chapters.find((x) => x.id === id)?.volume ?? 1,
    read: async (_v: number, id: number): Promise<Chapter | null> => {
      const c = chapters.find((x) => x.id === id);
      if (!c) return null;
      return { ...metaOf(c), volume: c.volume ?? 1, content: c.content };
    },
  } as unknown as ChapterService;
}

describe('ExportService (G05-S05)', () => {
  it('导出 txt(去 HTML 标签、按章排序)', async () => {
    const svc = new ExportService(
      mockChapterService([
        { id: 2, title: '旅程', content: '<p>继续</p>' },
        { id: 1, title: '起点', content: '<p>张三<b>出发</b></p>' },
      ]),
    );
    const r = await svc.exportBook('txt');
    expect(r.mime).toBe('text/plain');
    expect(r.content).toContain('张三出发'); // 去标签
    expect(r.content.indexOf('第1章')).toBeLessThan(r.content.indexOf('第2章')); // 排序
  });

  it('仅导出 published 章节，且按 卷→章 二级排序', async () => {
    const svc = new ExportService(
      mockChapterService([
        { id: 3, title: '卷二开篇', content: '<p>三</p>', volume: 2, status: 'published' },
        { id: 1, title: '卷一开篇', content: '<p>一</p>', volume: 1, status: 'published' },
        { id: 2, title: '草稿', content: '<p>不该出现</p>', volume: 1, status: 'draft' },
      ]),
    );
    const r = await svc.exportBook('txt');
    expect(r.content).not.toContain('不该出现'); // draft 被过滤
    expect(r.content).toContain('一');
    expect(r.content).toContain('三');
    // 卷一(第1章) 在 卷二(第3章) 之前
    expect(r.content.indexOf('第1章')).toBeLessThan(r.content.indexOf('第3章'));
  });

  it('导出 md(# 标题)', async () => {
    const svc = new ExportService(mockChapterService([{ id: 1, title: 'X', content: '内容' }]));
    const r = await svc.exportBook('md');
    expect(r.content).toContain('# 第1章 X');
    expect(r.mime).toBe('text/markdown');
    expect(r.filename).toBe('export.md');
  });

  it('无已发布章节导出空内容', async () => {
    const svc = new ExportService(mockChapterService([{ id: 1, title: 'X', content: '内容', status: 'draft' }]));
    const r = await svc.exportBook('txt');
    expect(r.content).toBe('');
  });
});
