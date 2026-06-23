import { Hono } from 'hono';
import type { StatsService } from '../services/stats-service.js';

/** 统计路由(G05-S06):GET /stats */
export function statsRoute(service: StatsService) {
  const app = new Hono();
  app.get('/', async (c) => c.json(await service.getStats()));
  return app;
}
