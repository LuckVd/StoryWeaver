import { Hono } from 'hono';
import type { BookService } from '../services/book-service.js';
import { APIError } from '../error-handler.js';
import { ErrorCode } from '@storyweaver/core';
import { validate } from '../validate.js';
import { createVolumeSchema, updateVolumeSchema } from '../schemas.js';

/**
 * 卷宗路由
 *
 * GET    /volumes         — 列出所有卷宗
 * POST   /volumes         — 创建新卷
 * PUT    /volumes/:id     — 更新卷标题
 */
export function volumesRoute(service: BookService): Hono {
  const app = new Hono();

  app.get('/', async (c) => {
    const book = await service.read();
    if (!book) {
      throw new APIError(ErrorCode.NOT_FOUND, '书籍不存在');
    }
    return c.json(book.volumes);
  });

  app.post('/', validate(createVolumeSchema), async (c) => {
    const data = c.get('validated');
    try {
      const { volumeId, book } = await service.addVolume(data.title);
      const volume = book.volumes.find((v) => v.id === volumeId)!;
      return c.json(volume, 201);
    } catch (err) {
      if (err instanceof Error && err.message === 'BOOK_NOT_FOUND') {
        throw new APIError(ErrorCode.NOT_FOUND, '书籍不存在');
      }
      throw err;
    }
  });

  app.put('/:id', validate(updateVolumeSchema), async (c) => {
    const volumeId = Number(c.req.param('id'));
    if (!Number.isInteger(volumeId) || volumeId < 1) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '卷号必须为正整数');
    }
    const data = c.get('validated');
    try {
      const book = await service.updateVolume(volumeId, data.title);
      const volume = book.volumes.find((v) => v.id === volumeId)!;
      return c.json(volume);
    } catch (err) {
      if (err instanceof Error && err.message === 'VOLUME_NOT_FOUND') {
        throw new APIError(ErrorCode.NOT_FOUND, `卷宗 ${volumeId} 不存在`);
      }
      throw err;
    }
  });

  return app;
}
