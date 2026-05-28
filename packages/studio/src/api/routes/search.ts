import { Hono } from 'hono';
import type { InMemorySearchEngine } from '@storyweaver/core';
import { APIError } from '../error-handler.js';
import { ErrorCode } from '@storyweaver/core';
import { VALID_SEARCH_SCOPES } from '../schemas.js';

/**
 * 搜索路由
 *
 * GET /search?q=...&scope=all — 全文搜索
 */
export function searchRoute(engine: InMemorySearchEngine): Hono {
  const app = new Hono();

  app.get('/', async (c) => {
    const q = c.req.query('q')?.trim();
    if (!q) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '搜索关键词不能为空');
    }

    const scopeParam = c.req.query('scope') ?? 'all';
    if (!VALID_SEARCH_SCOPES.includes(scopeParam as typeof VALID_SEARCH_SCOPES[number])) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, `scope 必须为: ${VALID_SEARCH_SCOPES.join(', ')}`);
    }

    const results = engine.search(q, scopeParam as typeof VALID_SEARCH_SCOPES[number]);
    return c.json({ query: q, scope: scopeParam, total: results.length, results });
  });

  return app;
}
