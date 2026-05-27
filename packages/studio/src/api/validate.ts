import type { MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { ErrorCode } from '@storyweaver/core';

/**
 * Zod 校验中间件工厂
 *
 * 校验请求体 JSON，成功后注入 `c.req.validated`。
 * 校验失败返回 400 VALIDATION_ERROR。
 */
export function validate<T>(schema: z.ZodSchema<T>): MiddlewareHandler<{ Variables: { validated: T } }> {
  return async (c, next) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { error: { code: ErrorCode.VALIDATION_ERROR, message: 'Invalid JSON body' } },
        400,
      );
    }

    const result = schema.safeParse(body);
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      return c.json(
        { error: { code: ErrorCode.VALIDATION_ERROR, message } },
        400,
      );
    }

    // 将校验结果存入 context，路由可通过 c.get('validated') 获取
    c.set('validated', result.data);
    await next();
  };
}
