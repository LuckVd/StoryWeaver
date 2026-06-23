import { Hono } from 'hono';
import type { SummaryService } from '../services/summary-service.js';

/**
 * 记忆派生视图路由
 *
 * GET /memory/timeline         — 时间线（按章节聚合的情节事件）
 * GET /memory/character-states — 角色状态变迁（聚合 + 当前状态）
 *
 * 数据由发布流程在章节摘要生成后确定性重建，不调 LLM。
 */
export function memoryRoute(summaryService: SummaryService): Hono {
  const app = new Hono();

  app.get('/timeline', async (c) => c.json(await summaryService.getTimeline()));

  app.get('/character-states', async (c) => c.json(await summaryService.getCharacterStates()));

  // Curator 提取的实体建议（待人工确认后入库）
  app.get('/curation', async (c) => c.json(await summaryService.getCurationSuggestions()));

  // 手动重建派生记忆（基于全部章节摘要重新聚合），供排查/补救
  app.post('/rebuild', async (c) => {
    const { timeline, characterStates } = await summaryService.rebuildTimelineAndCharacterStates();
    return c.json({ timeline, characterStates });
  });

  // 移除某条 curation 建议（前端确认入库或忽略后调用）
  app.post('/curation/remove', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      chapter: number;
      type: 'characters' | 'hooks' | 'worldEntries';
      name: string;
    };
    await summaryService.removeCurationEntity(body.chapter, body.type, body.name);
    return c.json({ ok: true });
  });

  return app;
}
