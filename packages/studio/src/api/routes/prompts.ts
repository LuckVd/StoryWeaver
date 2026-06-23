import { Hono } from 'hono';
import type { PromptService } from '../services/prompt-service.js';

/** Prompt 管理路由(G05-S08) */
export function promptsRoute(service: PromptService) {
  const app = new Hono();

  /** 列出全部 prompt */
  app.get('/', async (c) => c.json({ prompts: await service.list() }));

  /** 读取单个 prompt(当前 + 默认 + 是否覆盖) */
  app.get('/:name', async (c) => {
    const p = await service.get(c.req.param('name'));
    if (!p) return c.json({ error: { message: '未知 prompt' } }, 404);
    return c.json(p);
  });

  /** 编辑 / 覆盖 */
  app.put('/:name', async (c) => {
    const { content } = await c.req.json();
    await service.set(c.req.param('name'), content);
    return c.json({ ok: true });
  });

  /** 恢复默认 */
  app.delete('/:name', async (c) => {
    await service.reset(c.req.param('name'));
    return c.json({ ok: true });
  });

  return app;
}
