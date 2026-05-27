import { Hono } from 'hono';
import type { BookService } from '../services/book-service.js';
import type { ChapterService } from '../services/chapter-service.js';
import { APIError } from '../error-handler.js';
import { ErrorCode } from '@storyweaver/core';
import { validate } from '../validate.js';
import { createChapterSchema, updateChapterSchema, updateStatusSchema } from '../schemas.js';

/**
 * 章节路由
 *
 * GET    /chapters                 — 列出章节（?volume=N 可选过滤）
 * POST   /chapters                 — 创建章节
 * GET    /chapters/:id             — 获取章节详情（含内容）
 * PUT    /chapters/:id             — 更新章节标题/内容
 * DELETE /chapters/:id             — 删除章节（仅 draft）
 * PUT    /chapters/:id/status      — 状态流转
 */
export function chaptersRoute(bookService: BookService, chapterService: ChapterService): Hono {
  const app = new Hono();

  // GET /chapters — 列出章节
  app.get('/', async (c) => {
    const volumeParam = c.req.query('volume');
    const volume = volumeParam ? Number(volumeParam) : undefined;
    if (volume !== undefined && (!Number.isInteger(volume) || volume < 1)) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, 'volume 查询参数必须为正整数');
    }
    const chapters = await chapterService.list(volume);
    return c.json(chapters);
  });

  // POST /chapters — 创建章节
  app.post('/', validate(createChapterSchema), async (c) => {
    const data = c.get('validated');
    // 校验卷宗存在
    const book = await bookService.read();
    if (!book) {
      throw new APIError(ErrorCode.NOT_FOUND, '书籍不存在');
    }
    const volumeExists = book.volumes.some((v) => v.id === data.volume);
    if (!volumeExists) {
      throw new APIError(ErrorCode.NOT_FOUND, `卷宗 ${data.volume} 不存在`);
    }
    // 分配章节 ID
    const { chapterId } = await bookService.allocateChapterId();
    const meta = await chapterService.create(data.volume, chapterId, data.title);
    return c.json({ ...meta, volume: data.volume, content: '' }, 201);
  });

  // GET /chapters/:id — 获取章节详情
  app.get('/:id', async (c) => {
    const chapterId = Number(c.req.param('id'));
    if (!Number.isInteger(chapterId) || chapterId < 1) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '章节 ID 必须为正整数');
    }
    const volume = await chapterService.findVolume(chapterId);
    if (volume === null) {
      throw new APIError(ErrorCode.CHAPTER_NOT_FOUND, `章节 ${chapterId} 不存在`);
    }
    const chapter = await chapterService.read(volume, chapterId);
    return c.json(chapter);
  });

  // PUT /chapters/:id — 更新章节
  app.put('/:id', validate(updateChapterSchema), async (c) => {
    const chapterId = Number(c.req.param('id'));
    if (!Number.isInteger(chapterId) || chapterId < 1) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '章节 ID 必须为正整数');
    }
    const data = c.get('validated');
    const volume = await chapterService.findVolume(chapterId);
    if (volume === null) {
      throw new APIError(ErrorCode.CHAPTER_NOT_FOUND, `章节 ${chapterId} 不存在`);
    }
    try {
      const chapter = await chapterService.update(volume, chapterId, data);
      return c.json(chapter);
    } catch (err) {
      if (err instanceof Error && err.message === 'CHAPTER_LOCKED') {
        throw new APIError(ErrorCode.CHAPTER_LOCKED, '已发布章节不可修改');
      }
      throw err;
    }
  });

  // DELETE /chapters/:id — 删除章节
  app.delete('/:id', async (c) => {
    const chapterId = Number(c.req.param('id'));
    if (!Number.isInteger(chapterId) || chapterId < 1) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '章节 ID 必须为正整数');
    }
    const volume = await chapterService.findVolume(chapterId);
    if (volume === null) {
      throw new APIError(ErrorCode.CHAPTER_NOT_FOUND, `章节 ${chapterId} 不存在`);
    }
    try {
      const deleted = await chapterService.delete(volume, chapterId);
      if (!deleted) {
        throw new APIError(ErrorCode.CHAPTER_NOT_FOUND, `章节 ${chapterId} 不存在`);
      }
      return c.json({ ok: true });
    } catch (err) {
      if (err instanceof Error && err.message === 'CHAPTER_LOCKED') {
        throw new APIError(ErrorCode.CHAPTER_LOCKED, '仅 draft 状态的章节可以删除');
      }
      throw err;
    }
  });

  // PUT /chapters/:id/status — 状态流转
  app.put('/:id/status', validate(updateStatusSchema), async (c) => {
    const chapterId = Number(c.req.param('id'));
    if (!Number.isInteger(chapterId) || chapterId < 1) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '章节 ID 必须为正整数');
    }
    const { status } = c.get('validated');
    const volume = await chapterService.findVolume(chapterId);
    if (volume === null) {
      throw new APIError(ErrorCode.CHAPTER_NOT_FOUND, `章节 ${chapterId} 不存在`);
    }
    try {
      const meta = await chapterService.updateStatus(volume, chapterId, status);
      if (!meta) {
        throw new APIError(ErrorCode.CHAPTER_NOT_FOUND, `章节 ${chapterId} 不存在`);
      }
      return c.json(meta);
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_STATUS_TRANSITION') {
        throw new APIError(ErrorCode.VALIDATION_ERROR, '状态流转不合法：只能 draft→approved→published');
      }
      throw err;
    }
  });

  return app;
}
