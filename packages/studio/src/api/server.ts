import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { SSEEmitter } from './sse.js';
import { AIOperationQueue } from './queue.js';
import { errorHandler } from './error-handler.js';
import { eventsRoute } from './routes/events.js';

/**
 * 创建 Hono API Server 实例
 *
 * 组装中间件（CORS）和路由（events），注册全局错误处理器，
 * 导出 app + sseEmitter + aiQueue 供路由注册和外部使用。
 */
export function createServer() {
  const app = new Hono();
  const sseEmitter = new SSEEmitter();
  const aiQueue = new AIOperationQueue();

  // 全局错误处理
  app.onError(errorHandler);

  // 中间件
  app.use('/api/v1/*', cors({ origin: 'http://localhost:3000' }));

  // 路由
  app.route('/api/v1', eventsRoute(sseEmitter));

  // 健康检查
  app.get('/api/v1/health', (c) => c.json({ status: 'ok' }));

  return { app, sseEmitter, aiQueue };
}
