import { config } from 'dotenv';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { libraryDir } from '@storyweaver/core';
import { createLibraryServer } from './library-server.js';
import { migrateLegacyBookIfNeeded } from './migrate.js';

// 从项目根目录加载 .env
config({ path: resolve(import.meta.dirname, '../../../../.env') });

const port = Number(process.env.API_PORT ?? 3001);
const libraryRoot = libraryDir();
const handle = createLibraryServer(libraryRoot);

// 首次迁移(单书 → 书架第一本),随后恢复当前书,最后启动 HTTP 服务
migrateLegacyBookIfNeeded(process.cwd(), handle.libraryStorage)
  .then(() => handle.restoreActive())
  .then(() => {
    serve({ fetch: handle.app.fetch, port, hostname: process.env.API_HOST ?? '0.0.0.0' }, (info) => {
      console.log(`StoryWeaver API running at http://localhost:${info.port}`);
      console.log(`  Health: http://localhost:${info.port}/api/v1/health`);
      console.log(`  Library: ${libraryRoot}`);
    });
  })
  .catch((e) => {
    console.error('启动失败:', e);
    process.exit(1);
  });
