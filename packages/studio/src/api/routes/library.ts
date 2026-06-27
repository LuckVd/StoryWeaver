import { Hono } from 'hono';
import type { LibraryService } from '../services/library-service.js';
import { APIError } from '../error-handler.js';
import { ErrorCode, ChapterStorage, VolumeIndexStorage, VersionStorage } from '@storyweaver/core';
import { validate } from '../validate.js';
import { createBookSchema, updateBookSchema } from '../schemas.js';
import { ChapterService } from '../services/chapter-service.js';
import { ExportService } from '../services/export-service.js';

/**
 * 书架路由(始终可用,即使尚未打开任何书)
 *
 * GET    /library                    — 列出书架所有书 + 当前书 slug
 * POST   /library                    — 新建书并自动切换到新书
 * PUT    /library/:slug              — 编辑指定书(不依赖当前打开的书)
 * POST   /library/:slug/activate     — 切换到指定书
 * DELETE /library/:slug              — 删除书(删当前书则自动切到另一本或清空)
 * GET    /library/:slug/export       — 导出指定书(TXT/Markdown)
 */
export function libraryRoute(
  service: LibraryService,
  switchBook: (slug: string) => Promise<void>,
  deleteBook: (slug: string) => Promise<void>,
): Hono {
  const app = new Hono();

  // GET /library — 书架列表 + 当前书
  app.get('/', async (c) => {
    const [books, current] = await Promise.all([service.list(), service.getCurrent()]);
    return c.json({ books, current });
  });

  // GET /library/activity — 写作活跃聚合(跨所有书,近 N 天)
  app.get('/activity', async (c) => {
    const raw = Number(c.req.query('days') ?? 364);
    const days = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 730) : 364;
    const activity = await service.getActivity(days);
    return c.json({ activity });
  });

  // POST /library — 新建书 + 自动切换
  app.post('/', validate(createBookSchema), async (c) => {
    const data = c.get('validated');
    const { slug, book } = await service.create(data);
    await switchBook(slug);
    return c.json({ slug, book }, 201);
  });

  // PUT /library/:slug — 编辑指定书元信息
  app.put('/:slug', validate(updateBookSchema), async (c) => {
    const slug = c.req.param('slug');
    if (!service.exists(slug)) {
      throw new APIError(ErrorCode.NOT_FOUND, `书籍 ${slug} 不存在`);
    }
    try {
      const book = await service.updateBookMeta(slug, c.get('validated'));
      return c.json(book);
    } catch (err) {
      if (err instanceof Error && err.message === 'BOOK_NOT_FOUND') {
        throw new APIError(ErrorCode.NOT_FOUND, '书籍不存在');
      }
      throw err;
    }
  });

  // POST /library/:slug/activate — 切换到指定书
  app.post('/:slug/activate', async (c) => {
    const slug = c.req.param('slug');
    if (!service.exists(slug)) {
      throw new APIError(ErrorCode.NOT_FOUND, `书籍 ${slug} 不存在`);
    }
    await switchBook(slug);
    const book = await service.readBook(slug);
    return c.json({ slug, book });
  });

  // DELETE /library/:slug — 删除书
  app.delete('/:slug', async (c) => {
    const slug = c.req.param('slug');
    await deleteBook(slug);
    return c.json({ success: true });
  });

  // GET /library/:slug/export — 导出指定书(TXT/Markdown,不依赖当前打开的书)
  app.get('/:slug/export', async (c) => {
    const slug = c.req.param('slug');
    const format = c.req.query('format') === 'md' ? 'md' : 'txt';
    if (!service.exists(slug)) {
      throw new APIError(ErrorCode.NOT_FOUND, `书籍 ${slug} 不存在`);
    }
    const dir = service.bookPath(slug);
    const chapterService = new ChapterService(
      new VolumeIndexStorage(dir),
      new ChapterStorage(dir),
      new VersionStorage(),
      dir,
    );
    const { filename, content, mime } = await new ExportService(chapterService).exportBook(format);
    return new Response(content, {
      status: 200,
      headers: {
        'content-type': `${mime}; charset=utf-8`,
        'content-disposition': `attachment; filename="${filename}"`,
      },
    });
  });

  return app;
}
