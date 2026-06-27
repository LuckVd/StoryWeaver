import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { LibraryStorage, libraryDir, ErrorCode } from '@storyweaver/core';
import { createServer } from './server.js';
import { libraryRoute } from './routes/library.js';
import { LibraryService } from './services/library-service.js';
import { APIError, errorHandler } from './error-handler.js';

interface ActiveApp {
  app: Hono;
  fileWatcher: { stop(): Promise<void> };
  aiQueue: { isIdle: boolean };
}

export interface LibraryServerHandle {
  /** front app:动态委托给当前书的 app */
  app: Hono;
  /** 启动时恢复当前书(读 .current-book);无书则保持空书架态 */
  restoreActive: () => Promise<void>;
  /** 切换当前书(停旧 watcher + 重建 app + 启新 watcher) */
  switchBook: (slug: string) => Promise<void>;
  /** 删除一本书;若删的是当前书则切到另一本或清空 active */
  deleteBook: (slug: string) => Promise<void>;
  /** 停止当前书的文件监听(测试清理用) */
  dispose: () => Promise<void>;
  libraryStorage: LibraryStorage;
}

/**
 * 书架调度层(front app)。
 *
 * 在 createServer(单书 app,不变)之上加一层 front:统一 CORS、health、书架路由,
 * 其余 /api/v1/* 委托给"当前书"的 app。切书 = 停旧 watcher + 重建 createServer +
 * 启新 watcher。createServer 本身保持不变,故所有单书测试零改动。
 */
export function createLibraryServer(libraryRoot: string = libraryDir()): LibraryServerHandle {
  const libraryStorage = new LibraryStorage(libraryRoot);
  const libraryService = new LibraryService(libraryStorage);
  let active: ActiveApp | null = null;

  async function switchBook(slug: string): Promise<void> {
    if (!libraryStorage.exists(slug)) {
      throw new APIError(ErrorCode.NOT_FOUND, `书籍 ${slug} 不存在`);
    }
    // 切书前若有进行中的 AI 任务,拒绝(避免重建容器中断流式生成)
    if (active && !active.aiQueue.isIdle) {
      throw new APIError(ErrorCode.VALIDATION_ERROR, '有进行中的 AI 任务,请稍后再切换书籍');
    }
    if (active) {
      await active.fileWatcher.stop();
    }
    const handle = createServer(libraryStorage.bookPath(slug));
    active = { app: handle.app, fileWatcher: handle.fileWatcher, aiQueue: handle.aiQueue };
    handle.fileWatcher.start();
    await libraryStorage.setCurrent(slug);
  }

  async function restoreActive(): Promise<void> {
    const slug = await libraryStorage.getCurrent();
    if (slug && libraryStorage.exists(slug)) {
      const handle = createServer(libraryStorage.bookPath(slug));
      active = { app: handle.app, fileWatcher: handle.fileWatcher, aiQueue: handle.aiQueue };
      handle.fileWatcher.start();
    }
  }

  async function deleteBook(slug: string): Promise<void> {
    if (!libraryStorage.exists(slug)) {
      throw new APIError(ErrorCode.NOT_FOUND, `书籍 ${slug} 不存在`);
    }
    const { wasCurrent, fallback } = await libraryService.deleteBook(slug);
    if (wasCurrent) {
      if (fallback) {
        // 删的是当前书:切到另一本(重建 active + 更新指针)
        await switchBook(fallback);
      } else {
        // 书架空:停 active + 清指针
        if (active) {
          await active.fileWatcher.stop();
          active = null;
        }
        await libraryStorage.setCurrent('');
      }
    }
  }

  async function dispose(): Promise<void> {
    if (active) {
      await active.fileWatcher.stop();
      active = null;
    }
  }

  const front = new Hono();
  front.onError(errorHandler);
  front.use('/api/v1/*', cors({ origin: 'http://localhost:3000' }));
  // 书架路由始终可用(即使尚未打开任何书)
  front.route('/api/v1/library', libraryRoute(libraryService, switchBook, deleteBook));
  front.get('/api/v1/health', (c) => c.json({ status: 'ok' }));
  // 其余 /api/v1/* 委托给当前书的 app;无书时提示去书架
  front.all('/api/v1/*', async (c) => {
    if (!active) {
      throw new APIError(ErrorCode.NOT_FOUND, '尚无打开的书,请先在书架新建或选择一本书');
    }
    return active.app.fetch(c.req.raw);
  });

  return { app: front, restoreActive, switchBook, deleteBook, dispose, libraryStorage };
}
