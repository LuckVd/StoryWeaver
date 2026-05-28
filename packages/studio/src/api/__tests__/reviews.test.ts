import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from '../server.js';

describe('Reviews API', () => {
  let projectRoot: string;
  let app: ReturnType<typeof createServer>['app'];

  const sampleReport = {
    id: 'abc12345-6789',
    chapterId: 1,
    overallScore: 7.5,
    scores: [
      { dimension: 'character_consistency', score: 8, weight: 0.2, comment: '好' },
    ],
    issues: [
      { dimension: 'hooks', severity: 'medium' as const, location: '第三段', description: '伏笔未推进', suggestion: '增加回扣' },
    ],
    summary: '整体不错',
    createdAt: '2026-05-28T10:00:00Z',
  };

  beforeAll(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-reviews-test-'));
    const server = createServer(projectRoot);
    app = server.app;

    // 创建 reviews 目录和测试文件
    const reviewsDir = join(projectRoot, 'reviews');
    mkdirSync(reviewsDir, { recursive: true });
    writeFileSync(
      join(reviewsDir, 'ch001-review-abc12345.json'),
      JSON.stringify(sampleReport),
    );
    writeFileSync(
      join(reviewsDir, 'ch002-review-def45678.json'),
      JSON.stringify({ ...sampleReport, id: 'def45678', chapterId: 2 }),
    );
  });

  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('GET /api/v1/chapters/1/reviews — 返回章节1的报告', async () => {
    const res = await app.request('/api/v1/chapters/1/reviews');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].chapterId).toBe(1);
    expect(body[0].overallScore).toBe(7.5);
    expect(body[0].issues).toHaveLength(1);
  });

  it('GET /api/v1/chapters/2/reviews — 返回章节2的报告', async () => {
    const res = await app.request('/api/v1/chapters/2/reviews');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].chapterId).toBe(2);
  });

  it('GET /api/v1/chapters/999/reviews — 无报告返回空数组', async () => {
    const res = await app.request('/api/v1/chapters/999/reviews');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('GET /api/v1/chapters/invalid/reviews — 非法ID返回400', async () => {
    const res = await app.request('/api/v1/chapters/invalid/reviews');
    expect(res.status).toBe(400);
  });

  it('reports sorted by createdAt descending', async () => {
    const reviewsDir = join(projectRoot, 'reviews');
    writeFileSync(
      join(reviewsDir, 'ch001-review-new001.json'),
      JSON.stringify({ ...sampleReport, id: 'new001', createdAt: '2026-05-28T12:00:00Z' }),
    );

    const res = await app.request('/api/v1/chapters/1/reviews');
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(new Date(body[0].createdAt).getTime()).toBeGreaterThan(
      new Date(body[1].createdAt).getTime(),
    );
  });
});
