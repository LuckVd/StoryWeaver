import { Hono } from 'hono';
import type { BookService } from '../services/book-service.js';
import type { ChapterService } from '../services/chapter-service.js';
import type { SummaryService } from '../services/summary-service.js';
import type { ReviewService } from '../services/review-service.js';
import { APIError } from '../error-handler.js';
import { ErrorCode } from '@storyweaver/core';
import { validate } from '../validate.js';
import { createChapterSchema, updateChapterSchema, updateStatusSchema, restoreVersionSchema } from '../schemas.js';

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
export function chaptersRoute(bookService: BookService, chapterService: ChapterService, summaryService: SummaryService, reviewService: ReviewService): Hono {
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
        throw new APIError(ErrorCode.CHAPTER_LOCKED, '非草稿状态章节不可删除，请先回退为草稿');
      }
      if (err instanceof Error && err.message === 'ONLY_LATEST_DELETABLE') {
        throw new APIError(ErrorCode.VALIDATION_ERROR, '只能删除最新的章节（避免中间空缺）');
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
      const before = await chapterService.read(volume, chapterId);
      const meta = await chapterService.updateStatus(volume, chapterId, status);
      if (!meta) {
        throw new APIError(ErrorCode.CHAPTER_NOT_FOUND, `章节 ${chapterId} 不存在`);
      }
      // 发布时异步生成章节摘要（记 generating 状态，前端轮询可见）
      if (status === 'published') {
        summaryService.startGenerate(volume, chapterId);
      }
      // 回退草稿（published→draft）时删除该章摘要（摘要只在 published 时生成）
      if (before?.status === 'published' && status === 'draft') {
        await summaryService.deleteChapterSummary(chapterId).catch(() => {});
      }
      return c.json(meta);
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_STATUS_TRANSITION') {
        throw new APIError(ErrorCode.VALIDATION_ERROR, '状态流转不合法');
      }
      throw err;
    }
  });

  // GET /chapters/:id/summary — 获取章节摘要（发布后生成）
  app.get('/:id/summary', async (c) => {
    const chapterId = Number(c.req.param('id'));
    if (!Number.isInteger(chapterId) || chapterId < 1) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '章节 ID 必须为正整数');
    }
    const summary = await summaryService.getChapterSummary(chapterId);
    return c.json({ summary, generating: summaryService.isGenerating(chapterId) });
  });

  // POST /chapters/:id/summary — 异步启动摘要生成（立即返回 generating=true，前端轮询 GET 查进度）
  app.post('/:id/summary', async (c) => {
    const chapterId = Number(c.req.param('id'));
    if (!Number.isInteger(chapterId) || chapterId < 1) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '章节 ID 必须为正整数');
    }
    const volume = await chapterService.findVolume(chapterId);
    if (volume === null) {
      throw new APIError(ErrorCode.CHAPTER_NOT_FOUND, `章节 ${chapterId} 不存在`);
    }
    summaryService.startGenerate(volume, chapterId);
    return c.json({ generating: true });
  });

  // POST /chapters/:id/review — 触发 AI 审稿（不改状态，返回报告）
  app.post('/:id/review', async (c) => {
    const chapterId = Number(c.req.param('id'));
    if (!Number.isInteger(chapterId) || chapterId < 1) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '章节 ID 必须为正整数');
    }
    const volume = await chapterService.findVolume(chapterId);
    if (volume === null) {
      throw new APIError(ErrorCode.CHAPTER_NOT_FOUND, `章节 ${chapterId} 不存在`);
    }
    try {
      const report = await reviewService.reviewChapter(volume, chapterId);
      return c.json(report, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      throw new APIError(ErrorCode.INTERNAL_ERROR, `审稿失败：${msg}`);
    }
  });

  // POST /chapters/:id/revise — 根据审稿意见 AI 修订正文，返回 { original, revised }
  app.post('/:id/revise', async (c) => {
    const chapterId = Number(c.req.param('id'));
    if (!Number.isInteger(chapterId) || chapterId < 1) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '章节 ID 必须为正整数');
    }
    const volume = await chapterService.findVolume(chapterId);
    if (volume === null) {
      throw new APIError(ErrorCode.CHAPTER_NOT_FOUND, `章节 ${chapterId} 不存在`);
    }
    const body = await c.req.json().catch(() => ({}));
    try {
      const result = await reviewService.reviseChapter(volume, chapterId, body.issues ?? []);
      return c.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      throw new APIError(ErrorCode.INTERNAL_ERROR, `修订失败：${msg}`);
    }
  });

  // POST /chapters/:id/curate — 手动触发 Curator 提取知识库实体建议（异步，立即返回）
  app.post('/:id/curate', async (c) => {
    const chapterId = Number(c.req.param('id'));
    if (!Number.isInteger(chapterId) || chapterId < 1) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '章节 ID 必须为正整数');
    }
    const volume = await chapterService.findVolume(chapterId);
    if (volume === null) {
      throw new APIError(ErrorCode.CHAPTER_NOT_FOUND, `章节 ${chapterId} 不存在`);
    }
    summaryService.startCurate(volume, chapterId);
    return c.json({ curating: true });
  });

  // GET /chapters/:id/versions — 列出版本历史
  app.get('/:id/versions', async (c) => {
    const chapterId = Number(c.req.param('id'));
    if (!Number.isInteger(chapterId) || chapterId < 1) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '章节 ID 必须为正整数');
    }
    const volume = await chapterService.findVolume(chapterId);
    if (volume === null) {
      throw new APIError(ErrorCode.CHAPTER_NOT_FOUND, `章节 ${chapterId} 不存在`);
    }
    const versions = await chapterService.listVersions(volume, chapterId);
    return c.json(versions);
  });

  // GET /chapters/:id/versions/:vid — 获取指定版本
  app.get('/:id/versions/:vid', async (c) => {
    const chapterId = Number(c.req.param('id'));
    const versionId = Number(c.req.param('vid'));
    if (!Number.isInteger(chapterId) || chapterId < 1) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '章节 ID 必须为正整数');
    }
    if (!Number.isInteger(versionId) || versionId < 1) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '版本 ID 必须为正整数');
    }
    const volume = await chapterService.findVolume(chapterId);
    if (volume === null) {
      throw new APIError(ErrorCode.CHAPTER_NOT_FOUND, `章节 ${chapterId} 不存在`);
    }
    const version = await chapterService.readVersion(volume, chapterId, versionId);
    if (!version) {
      throw new APIError(ErrorCode.NOT_FOUND, `版本 ${versionId} 不存在`);
    }
    return c.json(version);
  });

  // POST /chapters/:id/versions/:vid/restore — 恢复到指定版本
  app.post('/:id/versions/:vid/restore', validate(restoreVersionSchema), async (c) => {
    const chapterId = Number(c.req.param('id'));
    const versionId = Number(c.req.param('vid'));
    if (!Number.isInteger(chapterId) || chapterId < 1) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '章节 ID 必须为正整数');
    }
    if (!Number.isInteger(versionId) || versionId < 1) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '版本 ID 必须为正整数');
    }
    const volume = await chapterService.findVolume(chapterId);
    if (volume === null) {
      throw new APIError(ErrorCode.CHAPTER_NOT_FOUND, `章节 ${chapterId} 不存在`);
    }
    const chapter = await chapterService.restoreVersion(volume, chapterId, versionId);
    if (!chapter) {
      throw new APIError(ErrorCode.NOT_FOUND, `版本 ${versionId} 不存在`);
    }
    return c.json(chapter);
  });

  return app;
}
