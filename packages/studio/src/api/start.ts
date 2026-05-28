import { config } from 'dotenv';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { createServer } from './server.js';

// 从项目根目录加载 .env
config({ path: resolve(import.meta.dirname, '../../../../.env') });

const port = Number(process.env.API_PORT ?? 3001);

const { app } = createServer(process.cwd());

serve({ fetch: app.fetch, port, hostname: process.env.API_HOST ?? '127.0.0.1' }, (info) => {
  console.log(`StoryWeaver API running at http://localhost:${info.port}`);
  console.log(`  Health: http://localhost:${info.port}/api/v1/health`);
});
