import { Hono } from 'hono';
import type { KnowledgeService } from '../services/knowledge-service.js';
import { APIError } from '../error-handler.js';
import { ErrorCode } from '@storyweaver/core';
import { validate } from '../validate.js';
import {
  createCharacterSchema,
  updateCharacterSchema,
  createWorldSchema,
  updateWorldSchema,
  createItemSchema,
  updateItemSchema,
  createHookSchema,
  updateHookSchema,
  createRuleSchema,
  updateRuleSchema,
  createCustomSchema,
  updateCustomSchema,
  outlineSchema,
  createRelationSchema,
  updateRelationSchema,
  validateWorldSub,
  customNameSchema,
  extractEntitiesSchema,
} from '../schemas.js';

/**
 * 知识库路由
 *
 * GET    /knowledge                        — 概览
 * GET    /knowledge/characters             — 列出角色
 * POST   /knowledge/characters             — 创建角色
 * GET    /knowledge/characters/:id         — 获取角色
 * PUT    /knowledge/characters/:id         — 更新角色
 * DELETE /knowledge/characters/:id         — 删除角色
 * GET    /knowledge/world?sub=geography    — 列出世界观条目
 * POST   /knowledge/world                  — 创建世界观条目
 * PUT    /knowledge/world/:id?sub=geography — 更新世界观条目
 * DELETE /knowledge/world/:id?sub=geography — 删除世界观条目
 * GET    /knowledge/items                  — 列出物品
 * POST   /knowledge/items                  — 创建物品
 * PUT    /knowledge/items/:id              — 更新物品
 * DELETE /knowledge/items/:id              — 删除物品
 * GET    /knowledge/hooks                  — 列出伏笔
 * POST   /knowledge/hooks                  — 创建伏笔
 * PUT    /knowledge/hooks/:id              — 更新伏笔
 * DELETE /knowledge/hooks/:id              — 删除伏笔
 * GET    /knowledge/rules                  — 列出规则
 * POST   /knowledge/rules                  — 创建规则
 * PUT    /knowledge/rules/:id              — 更新规则
 * DELETE /knowledge/rules/:id              — 删除规则
 * GET    /knowledge/custom?name=factions   — 列出自定义分类
 * POST   /knowledge/custom?name=factions   — 创建自定义条目
 * PUT    /knowledge/custom/:id?name=factions — 更新自定义条目
 * DELETE /knowledge/custom/:id?name=factions — 删除自定义条目
 * GET    /knowledge/outline                — 获取大纲
 * PUT    /knowledge/outline                — 更新大纲
 * GET    /knowledge/relations              — 列出关系
 * POST   /knowledge/relations              — 创建关系
 * PUT    /knowledge/relations/:id          — 更新关系
 * DELETE /knowledge/relations/:id          — 删除关系
 * POST   /knowledge/extract                — AI 智能提取实体(不落库)
 */
export function knowledgeRoute(service: KnowledgeService): Hono {
  const app = new Hono();

  // GET /knowledge — 概览
  app.get('/', async (c) => {
    const overview = await service.overview();
    return c.json(overview);
  });

  // ── Characters ──

  app.get('/characters', async (c) => {
    const list = await service.listCharacters();
    return c.json(list);
  });

  app.post('/characters', validate(createCharacterSchema), async (c) => {
    const data = c.get('validated');
    const char = await service.createCharacter(data);
    return c.json(char, 201);
  });

  app.get('/characters/:id', async (c) => {
    const char = await service.getCharacter(c.req.param('id'));
    if (!char) throw new APIError(ErrorCode.NOT_FOUND, `角色不存在`);
    return c.json(char);
  });

  app.put('/characters/:id', validate(updateCharacterSchema), async (c) => {
    const updated = await service.updateCharacter(c.req.param('id'), c.get('validated'));
    if (!updated) throw new APIError(ErrorCode.NOT_FOUND, `角色不存在`);
    return c.json(updated);
  });

  app.delete('/characters/:id', async (c) => {
    const deleted = await service.deleteCharacter(c.req.param('id'));
    if (!deleted) throw new APIError(ErrorCode.NOT_FOUND, `角色不存在`);
    return c.json({ ok: true });
  });

  // ── World ──

  app.get('/world', async (c) => {
    const sub = c.req.query('sub');
    if (!sub) {
      // 返回所有世界观条目
      const all: Record<string, unknown[]> = {};
      for (const s of ['geography', 'power-system', 'factions', 'history', 'glossary'] as const) {
        all[s] = await service.listWorld(s);
      }
      return c.json(all);
    }
    const validSub = validateWorldSub(sub);
    const list = await service.listWorld(validSub as 'geography');
    return c.json(list);
  });

  app.post('/world', validate(createWorldSchema), async (c) => {
    const data = c.get('validated');
    const entry = await service.createWorld(data.category, data);
    return c.json(entry, 201);
  });

  app.put('/world/:id', validate(updateWorldSchema), async (c) => {
    const sub = c.req.query('sub');
    if (!sub) throw new APIError(ErrorCode.VALIDATION_ERROR, '缺少 sub 参数');
    const validSub = validateWorldSub(sub);
    const updated = await service.updateWorld(validSub as 'geography', c.req.param('id'), c.get('validated'));
    if (!updated) throw new APIError(ErrorCode.NOT_FOUND, `世界观条目不存在`);
    return c.json(updated);
  });

  app.delete('/world/:id', async (c) => {
    const sub = c.req.query('sub');
    if (!sub) throw new APIError(ErrorCode.VALIDATION_ERROR, '缺少 sub 参数');
    const validSub = validateWorldSub(sub);
    const deleted = await service.deleteWorld(validSub as 'geography', c.req.param('id'));
    if (!deleted) throw new APIError(ErrorCode.NOT_FOUND, `世界观条目不存在`);
    return c.json({ ok: true });
  });

  // ── Items ──

  app.get('/items', async (c) => {
    return c.json(await service.listItems());
  });

  app.post('/items', validate(createItemSchema), async (c) => {
    return c.json(await service.createItem(c.get('validated')), 201);
  });

  app.put('/items/:id', validate(updateItemSchema), async (c) => {
    const updated = await service.updateItem(c.req.param('id'), c.get('validated'));
    if (!updated) throw new APIError(ErrorCode.NOT_FOUND, `物品不存在`);
    return c.json(updated);
  });

  app.delete('/items/:id', async (c) => {
    const deleted = await service.deleteItem(c.req.param('id'));
    if (!deleted) throw new APIError(ErrorCode.NOT_FOUND, `物品不存在`);
    return c.json({ ok: true });
  });

  // ── Hooks ──

  app.get('/hooks', async (c) => {
    return c.json(await service.listHooks());
  });

  app.post('/hooks', validate(createHookSchema), async (c) => {
    return c.json(await service.createHook(c.get('validated')), 201);
  });

  app.put('/hooks/:id', validate(updateHookSchema), async (c) => {
    const updated = await service.updateHook(c.req.param('id'), c.get('validated'));
    if (!updated) throw new APIError(ErrorCode.NOT_FOUND, `伏笔不存在`);
    return c.json(updated);
  });

  app.delete('/hooks/:id', async (c) => {
    const deleted = await service.deleteHook(c.req.param('id'));
    if (!deleted) throw new APIError(ErrorCode.NOT_FOUND, `伏笔不存在`);
    return c.json({ ok: true });
  });

  // ── Rules ──

  app.get('/rules', async (c) => {
    return c.json(await service.listRules());
  });

  app.post('/rules', validate(createRuleSchema), async (c) => {
    return c.json(await service.createRule(c.get('validated')), 201);
  });

  app.put('/rules/:id', validate(updateRuleSchema), async (c) => {
    const updated = await service.updateRule(c.req.param('id'), c.get('validated'));
    if (!updated) throw new APIError(ErrorCode.NOT_FOUND, `规则不存在`);
    return c.json(updated);
  });

  app.delete('/rules/:id', async (c) => {
    const deleted = await service.deleteRule(c.req.param('id'));
    if (!deleted) throw new APIError(ErrorCode.NOT_FOUND, `规则不存在`);
    return c.json({ ok: true });
  });

  // ── Custom ──

  app.get('/custom', async (c) => {
    const name = c.req.query('name');
    if (!name) {
      const cats = await service.listCustomCategories();
      return c.json(cats);
    }
    const validName = customNameSchema.parse(name);
    return c.json(await service.listCustom(validName));
  });

  app.post('/custom', validate(createCustomSchema), async (c) => {
    const data = c.get('validated');
    return c.json(await service.createCustom(data.category, data), 201);
  });

  app.put('/custom/:id', validate(updateCustomSchema), async (c) => {
    const name = c.req.query('name');
    if (!name) throw new APIError(ErrorCode.VALIDATION_ERROR, '缺少 name 参数');
    const validName = customNameSchema.parse(name);
    const updated = await service.updateCustom(validName, c.req.param('id'), c.get('validated'));
    if (!updated) throw new APIError(ErrorCode.NOT_FOUND, `自定义条目不存在`);
    return c.json(updated);
  });

  app.delete('/custom/:id', async (c) => {
    const name = c.req.query('name');
    if (!name) throw new APIError(ErrorCode.VALIDATION_ERROR, '缺少 name 参数');
    const validName = customNameSchema.parse(name);
    const deleted = await service.deleteCustom(validName, c.req.param('id'));
    if (!deleted) throw new APIError(ErrorCode.NOT_FOUND, `自定义条目不存在`);
    return c.json({ ok: true });
  });

  // ── Outline ──

  app.get('/outline', async (c) => {
    const tree = await service.getOutline();
    if (!tree) return c.json(null);
    return c.json(tree);
  });

  app.put('/outline', validate(outlineSchema), async (c) => {
    const tree = await service.updateOutline(c.get('validated') as import('@storyweaver/core').OutlineNode);
    return c.json(tree);
  });

  // ── Relations ──

  app.get('/relations', async (c) => {
    return c.json(await service.listRelations());
  });

  app.post('/relations', validate(createRelationSchema), async (c) => {
    return c.json(await service.createRelation(c.get('validated')), 201);
  });

  app.put('/relations/:id', validate(updateRelationSchema), async (c) => {
    const updated = await service.updateRelation(c.req.param('id'), c.get('validated'));
    if (!updated) throw new APIError(ErrorCode.NOT_FOUND, `关系不存在`);
    return c.json(updated);
  });

  app.delete('/relations/:id', async (c) => {
    const deleted = await service.deleteRelation(c.req.param('id'));
    if (!deleted) throw new APIError(ErrorCode.NOT_FOUND, `关系不存在`);
    return c.json({ ok: true });
  });

  // ── AI 智能提取(不落库,前端确认后逐条入库) ──

  app.post('/extract', validate(extractEntitiesSchema), async (c) => {
    const { text } = c.get('validated');
    try {
      const result = await service.extractEntities(text);
      return c.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '提取失败';
      if (msg.includes('OPENAI_API_KEY')) {
        throw new APIError(
          ErrorCode.LLM_CONNECTION_FAILED,
          '未配置 AI 模型,无法提取。请在设置中配置模型或环境变量 OPENAI_API_KEY。',
        );
      }
      if (/retry|retries|Failed to get structured/i.test(msg)) {
        throw new APIError(ErrorCode.LLM_INVALID_RESPONSE, 'AI 输出格式异常,请重试或换一段文本。');
      }
      throw new APIError(ErrorCode.LLM_CONNECTION_FAILED, msg);
    }
  });

  return app;
}
