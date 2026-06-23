import { Hono } from 'hono';
import { z } from 'zod';
import type { ModelService } from '../services/model-service.js';

const modelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  service: z.string().min(1),
  apiKey: z.string(),
  baseUrl: z.string().optional(),
  contextWindow: z.number().optional(),
});

/** 模型配置管理路由(G05-S02) */
export function modelsRoute(service: ModelService) {
  const app = new Hono();

  /** 列出全部模型(脱敏) */
  app.get('/', async (c) => c.json({ models: await service.list() }));

  /** 新增 / 更新模型 */
  app.post('/', async (c) => {
    const body = await c.req.json();
    const model = modelSchema.parse(body);
    return c.json({ models: await service.upsert(model) });
  });

  /** 删除模型 */
  app.delete('/:id', async (c) => c.json({ models: await service.delete(c.req.param('id')) }));

  /** 测试连接 */
  app.post('/:id/test', async (c) => c.json(await service.test(c.req.param('id'))));

  /** 读取 Agent 模型分配(G05-S03) */
  app.get('/assignment', async (c) => c.json(await service.getAssignment()));

  /** 设置 Agent 模型分配 */
  app.put('/assignment', async (c) => {
    const body = await c.req.json();
    return c.json(await service.setAssignment(body));
  });

  return app;
}
