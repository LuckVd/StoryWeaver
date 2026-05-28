import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { BookStorage, ChapterStorage, VolumeIndexStorage, VersionStorage, KnowledgeStorage, OutlineStorage, RelationStorage } from '@storyweaver/core';
import { SSEEmitter } from './sse.js';
import { AIOperationQueue } from './queue.js';
import { errorHandler } from './error-handler.js';
import { eventsRoute } from './routes/events.js';
import { bookRoute } from './routes/book.js';
import { volumesRoute } from './routes/volumes.js';
import { chaptersRoute } from './routes/chapters.js';
import { chatRoute } from './routes/chat.js';
import { knowledgeRoute } from './routes/knowledge.js';
import { reviewsRoute } from './routes/reviews.js';
import { BookService } from './services/book-service.js';
import { ChapterService } from './services/chapter-service.js';
import { ChatService } from './services/chat-service.js';
import { KnowledgeService } from './services/knowledge-service.js';

/**
 * 创建 Hono API Server 实例
 *
 * 组装中间件（CORS）、服务层和路由，注册全局错误处理器，
 * 导出 app + sseEmitter + aiQueue 供外部使用。
 */
export function createServer(projectRoot: string = process.cwd()) {
  const app = new Hono();
  const sseEmitter = new SSEEmitter();
  const aiQueue = new AIOperationQueue();

  // 存储层
  const bookStorage = new BookStorage(projectRoot);
  const chapterStorage = new ChapterStorage(projectRoot);
  const indexStorage = new VolumeIndexStorage(projectRoot);
  const versionStorage = new VersionStorage();

  // 服务层
  const bookService = new BookService(bookStorage);
  const chapterService = new ChapterService(indexStorage, chapterStorage, versionStorage, projectRoot);
  const chatService = new ChatService(aiQueue, sseEmitter, chapterService);
  const knowledgeService = new KnowledgeService(
    new KnowledgeStorage(projectRoot),
    new OutlineStorage(projectRoot),
    new RelationStorage(projectRoot),
  );

  // 全局错误处理
  app.onError(errorHandler);

  // 中间件
  app.use('/api/v1/*', cors({ origin: 'http://localhost:3000' }));

  // 路由
  app.route('/api/v1', eventsRoute(sseEmitter));
  app.route('/api/v1/book', bookRoute(bookService));
  app.route('/api/v1/volumes', volumesRoute(bookService));
  app.route('/api/v1/chapters', chaptersRoute(bookService, chapterService));
  app.route('/api/v1/chat', chatRoute(chatService));
  app.route('/api/v1/knowledge', knowledgeRoute(knowledgeService));
  app.route('/api/v1', reviewsRoute(projectRoot));

  // 健康检查
  app.get('/api/v1/health', (c) => c.json({ status: 'ok' }));

  return { app, sseEmitter, aiQueue };
}
