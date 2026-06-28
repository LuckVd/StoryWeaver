import { config } from 'dotenv';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { libraryDir } from '@storyweaver/core';
import { createLibraryServer } from './library-server.js';
import { migrateLegacyBookIfNeeded } from './migrate.js';

export interface LaunchOptions {
  /** 监听端口,默认 API_PORT ?? 3001;0 = 系统分配随机端口(Electron 用) */
  port?: number;
  /** 监听地址,默认 API_HOST ?? '0.0.0.0';Electron 用 '127.0.0.1' 不对外暴露 */
  hostname?: string;
  /** 书架根目录,默认 libraryDir() */
  libraryRoot?: string;
  /** 单书迁移基准目录,默认 process.cwd() */
  projectRoot?: string;
  /** 是否加载项目根 .env,默认 true(CLI);Electron 内嵌运行可置 false */
  loadEnv?: boolean;
}

export interface LaunchedServer {
  port: number;
  hostname: string;
  /** 关闭后端服务(Electron 退出时调用) */
  close: () => Promise<void>;
}

/**
 * 启动 StoryWeaver 后端(书架调度层 + 当前书的 Hono app)。
 *
 * 抽自原 CLI 顶层逻辑,供命令行入口与 Electron 主进程复用:
 * 迁移单书 → 恢复当前书 → serve。port=0 时由系统分配随机端口,
 * 返回实际端口供调用方(如 Electron)注入给前端。
 */
export async function launchServer(opts: LaunchOptions = {}): Promise<LaunchedServer> {
  const {
    port = Number(process.env.API_PORT ?? 3001),
    hostname = process.env.API_HOST ?? '0.0.0.0',
    libraryRoot = libraryDir(),
    projectRoot = process.cwd(),
    loadEnv = true,
  } = opts;

  if (loadEnv) {
    config({ path: resolve(import.meta.dirname, '../../../../.env') });
  }

  const handle = createLibraryServer(libraryRoot);
  // Electron renderer(file:// 或 vite dev server)跨域 fetch loopback 后端,放开 CORS
  handle.app.use('*', cors({ origin: '*' }));
  await migrateLegacyBookIfNeeded(projectRoot, handle.libraryStorage);
  await handle.restoreActive();

  return await new Promise<LaunchedServer>((resolveServe, reject) => {
    const server = serve(
      { fetch: handle.app.fetch, port, hostname },
      (info) =>
        resolveServe({
          port: info.port,
          hostname,
          close: () => new Promise<void>((r) => server.close(() => r())),
        }),
    );
    server.on('error', reject);
  });
}

// CLI 入口:仅纯 Node 直接运行时启动(供 dev:api / 生产 node 入口)。
// Electron 主进程 process.versions.electron 有值 → 跳过,避免 bundle 后误触发二次 launchServer。
if (!process.versions.electron && import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  launchServer()
    .then(({ port }) => {
      console.log(`StoryWeaver API running at http://localhost:${port}`);
      console.log(`  Health: http://localhost:${port}/api/v1/health`);
      console.log(`  Library: ${libraryDir()}`);
    })
    .catch((e) => {
      console.error('启动失败:', e);
      process.exit(1);
    });
}
