import { Hono } from 'hono';
import type { ExportService } from '../services/export-service.js';

/** 导出路由(G05-S05):GET /export?format=txt|md */
export function exportRoute(service: ExportService) {
  const app = new Hono();

  app.get('/', async (c) => {
    const format = c.req.query('format') ?? 'txt';
    if (format !== 'txt' && format !== 'md') {
      return c.json({ error: { message: `不支持的格式: ${format}(仅 txt/md)` } }, 400);
    }
    const { filename, content, mime } = await service.exportBook(format);
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
