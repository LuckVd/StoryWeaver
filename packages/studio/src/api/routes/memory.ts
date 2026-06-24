import { Hono } from 'hono';
import { z } from 'zod';
import type { SummaryService } from '../services/summary-service.js';
import { validate } from '../validate.js';

const curationEntitySchema = z.object({
  chapter: z.number().int(),
  type: z.enum(['characters', 'hooks', 'worldEntries']),
  name: z.string().min(1),
});

const hookActionSchema = z.object({
  action: z.enum(['resolve', 'reactivate']),
});

/**
 * 记忆派生视图路由
 *
 * GET /memory/character-states — 角色状态变迁（聚合 + 当前状态）
 * GET /memory/hooks-tracking  — 伏笔追踪（聚合，确定性）
 * GET /memory/curation        — Curator 提取的实体建议（待人工确认）
 * POST /memory/rebuild        — 手动重建派生记忆
 * GET /memory/action-log      — 操作日志（伏笔/实体变更留痕）
 *
 * 数据由发布流程在章节摘要生成后确定性重建，不调 LLM。
 */
export function memoryRoute(summaryService: SummaryService): Hono {
  const app = new Hono();

  app.get('/character-states', async (c) => c.json(await summaryService.getCharacterStates()));

  // 伏笔追踪（Hook 实体 + 章节摘要聚合，确定性，不受回忆/穿越影响）
  app.get('/hooks-tracking', async (c) => c.json(await summaryService.getHooksTracking()));

  // Curator 提取的实体建议（待人工确认后入库）
  app.get('/curation', async (c) => c.json(await summaryService.getCurationSuggestions()));

  // 手动重建派生记忆（基于全部章节摘要重新聚合），供排查/补救
  app.post('/rebuild', async (c) => {
    const characterStates = await summaryService.rebuildCharacterStates();
    return c.json({ characterStates });
  });

  // 移除某条 curation 建议（前端确认入库或忽略后调用）
  app.post('/curation/remove', validate(curationEntitySchema), async (c) => {
    const { chapter, type, name } = c.get('validated');
    await summaryService.removeCurationEntity(chapter, type, name);
    return c.json({ ok: true });
  });

  // 确认实体建议：写入知识库 + 移除建议 + 记录（封装前端原本的两步）
  app.post('/curation/accept', validate(curationEntitySchema), async (c) => {
    const { chapter, type, name } = c.get('validated');
    try {
      await summaryService.acceptCuration(chapter, type, name);
      return c.json({ ok: true });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : '加入失败' }, 400);
    }
  });

  // 放弃实体建议：移除 + 记录（留痕可追溯）
  app.post('/curation/dismiss', validate(curationEntitySchema), async (c) => {
    const { chapter, type, name } = c.get('validated');
    await summaryService.dismissCuration(chapter, type, name);
    return c.json({ ok: true });
  });

  // 伏笔状态变更：完成(resolve) / 重新激活(reactivate)
  app.post('/hooks/:name/action', validate(hookActionSchema), async (c) => {
    const name = c.req.param('name');
    const { action } = c.get('validated');
    try {
      await summaryService.setHookAction(name, action);
      return c.json({ ok: true });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : '操作失败' }, 400);
    }
  });

  // 操作日志（伏笔状态变更、实体建议加入/放弃，均留痕）
  app.get('/action-log', async (c) => c.json(await summaryService.getActionLog()));

  return app;
}
