import { Hono } from 'hono';
import type { WorkspaceService } from '../services/workspace-service.js';
import { APIError } from '../error-handler.js';
import { ErrorCode } from '@storyweaver/core';
import { validate } from '../validate.js';
import { addChapterSchema, publishSchema } from '../schemas.js';

/**
 * 工作区路由
 *
 * GET    /workspace                — 获取工作区（含章节列表和状态）
 * POST   /workspace/chapters       — 添加章节到工作区
 * DELETE /workspace/chapters/:id   — 从工作区移除章节
 * POST   /workspace/publish        — 批量发布 approved 章节
 */
export function workspaceRoute(service: WorkspaceService): Hono {
  const app = new Hono();

  // GET /workspace — 获取工作区
  app.get('/', async (c) => {
    const ws = await service.getWorkspace();
    const chapters = await service.listChapters();
    return c.json({ ...ws, chapters });
  });

  // POST /workspace/chapters — 添加章节到工作区
  app.post('/chapters', validate(addChapterSchema), async (c) => {
    const { chapterId } = c.get('validated');
    try {
      const ws = await service.addChapter(chapterId);
      return c.json(ws, 201);
    } catch (err) {
      if ((err as Error).message === 'CHAPTER_ALREADY_IN_WORKSPACE') {
        throw new APIError(ErrorCode.VALIDATION_ERROR, '章节已在工作区中');
      }
      throw err;
    }
  });

  // DELETE /workspace/chapters/:id — 从工作区移除章节
  app.delete('/chapters/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id < 1) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '章节 ID 必须为正整数');
    }
    try {
      const ws = await service.removeChapter(id);
      return c.json(ws);
    } catch (err) {
      if ((err as Error).message === 'CHAPTER_NOT_IN_WORKSPACE') {
        throw new APIError(ErrorCode.NOT_FOUND, '章节不在工作区中');
      }
      throw err;
    }
  });

  // POST /workspace/publish — 批量发布
  app.post('/publish', validate(publishSchema), async (c) => {
    const { chapterIds, skipSummary } = c.get('validated');
    try {
      const result = await service.publish(chapterIds, skipSummary);
      return c.json(result);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.startsWith('CHAPTER_NOT_IN_WORKSPACE')) {
        throw new APIError(ErrorCode.VALIDATION_ERROR, `章节不在工作区中: ${msg.split(':')[1]}`);
      }
      if (msg.startsWith('CHAPTER_NOT_APPROVED')) {
        throw new APIError(ErrorCode.CHAPTER_NOT_APPROVED, `章节未定稿: ${msg.split(':')[1]}`);
      }
      if (msg.startsWith('CHAPTER_NOT_FOUND')) {
        throw new APIError(ErrorCode.CHAPTER_NOT_FOUND, `章节不存在: ${msg.split(':')[1]}`);
      }
      throw err;
    }
  });

  return app;
}
