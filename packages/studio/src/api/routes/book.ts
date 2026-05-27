import { Hono } from 'hono';
import type { BookService } from '../services/book-service.js';
import { APIError } from '../error-handler.js';
import { ErrorCode } from '@storyweaver/core';
import { validate } from '../validate.js';
import { createBookSchema, updateBookSchema } from '../schemas.js';

/**
 * 书籍路由
 *
 * POST   /book       — 创建书籍
 * GET    /book       — 获取书籍信息
 * PUT    /book       — 更新书籍信息
 */
export function bookRoute(service: BookService): Hono {
  const app = new Hono();

  app.post('/', validate(createBookSchema), async (c) => {
    const data = c.get('validated');
    try {
      const book = await service.create(data);
      return c.json(book, 201);
    } catch (err) {
      if (err instanceof Error && err.message === 'BOOK_ALREADY_EXISTS') {
        throw new APIError(ErrorCode.VALIDATION_ERROR, '书籍已存在');
      }
      throw err;
    }
  });

  app.get('/', async (c) => {
    const book = await service.read();
    if (!book) {
      throw new APIError(ErrorCode.NOT_FOUND, '书籍不存在');
    }
    return c.json(book);
  });

  app.put('/', validate(updateBookSchema), async (c) => {
    const data = c.get('validated');
    try {
      const book = await service.update(data);
      return c.json(book);
    } catch (err) {
      if (err instanceof Error && err.message === 'BOOK_NOT_FOUND') {
        throw new APIError(ErrorCode.NOT_FOUND, '书籍不存在');
      }
      throw err;
    }
  });

  return app;
}
