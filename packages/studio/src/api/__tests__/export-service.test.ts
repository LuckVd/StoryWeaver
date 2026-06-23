import { describe, it, expect } from 'vitest';
import { ExportService } from '../services/export-service.js';
import type { ChapterService } from '../services/chapter-service.js';
import type { ChapterMeta, Chapter } from '@storyweaver/core';

function mockChapterService(chapters: { id: number; title: string; content: string }[]): ChapterService {
  const metaOf = (c: { id: number; title: string }): ChapterMeta => ({
    id: c.id,
    title: c.title,
    status: 'draft',
    createdAt: '',
    updatedAt: '',
  });
  return {
    list: async () => chapters.map(metaOf),
    findVolume: async () => 1,
    read: async (_v: number, id: number): Promise<Chapter | null> => {
      const c = chapters.find((x) => x.id === id);
      if (!c) return null;
      return { ...metaOf(c), volume: 1, content: c.content };
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
    const lines = r.content.split('\n');
    expect(lines[0]).toContain('第1章 起点');
    expect(r.content).toContain('张三出发'); // 去标签
    expect(r.content.indexOf('第1章')).toBeLessThan(r.content.indexOf('第2章')); // 排序
  });

  it('导出 md(# 标题)', async () => {
    const svc = new ExportService(mockChapterService([{ id: 1, title: 'X', content: '内容' }]));
    const r = await svc.exportBook('md');
    expect(r.content).toContain('# 第1章 X');
    expect(r.mime).toBe('text/markdown');
    expect(r.filename).toBe('export.md');
  });

  it('无章节导出空内容', async () => {
    const svc = new ExportService(mockChapterService([]));
    const r = await svc.exportBook('txt');
    expect(r.content).toBe('');
  });
});
