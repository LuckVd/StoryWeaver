import { Hono } from 'hono';
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { ReviewReport } from '@storyweaver/core';
import { APIError } from '../error-handler.js';
import { ErrorCode } from '@storyweaver/core';

/**
 * 审稿报告路由
 *
 * GET /chapters/:id/reviews — 列出章节的所有审稿报告
 */
export function reviewsRoute(projectRoot: string): Hono {
  const app = new Hono();
  const reviewsDir = () => resolve(projectRoot, 'reviews');

  app.get('/chapters/:id/reviews', async (c) => {
    const chapterId = parseInt(c.req.param('id'), 10);
    if (isNaN(chapterId)) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '章节 ID 必须为数字');
    }

    const dir = reviewsDir();
    if (!existsSync(dir)) {
      return c.json([]);
    }

    const prefix = `ch${String(chapterId).padStart(3, '0')}-review-`;
    const entries = await readdir(dir);
    const reports: ReviewReport[] = [];

    for (const name of entries) {
      if (!name.startsWith(prefix) || !name.endsWith('.json')) continue;
      try {
        const raw = await readFile(resolve(dir, name), 'utf-8');
        reports.push(JSON.parse(raw) as ReviewReport);
      } catch {
        // 跳过损坏的文件
      }
    }

    // 按时间倒序
    reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json(reports);
  });

  return app;
}
