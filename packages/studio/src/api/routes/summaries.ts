import { Hono } from 'hono';
import type { SummaryService } from '../services/summary-service.js';

/**
 * 摘要路由
 *
 * GET /summaries — 列出所有章节摘要（按章节排序）
 */
export function summariesRoute(summaryService: SummaryService): Hono {
  const app = new Hono();

  app.get('/', async (c) => {
    return c.json(await summaryService.listSummaries());
  });

  app.get('/batch', async (c) => {
    return c.json(await summaryService.listBatchSummaries());
  });

  return app;
}
