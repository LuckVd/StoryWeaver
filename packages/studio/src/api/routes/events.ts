import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { SSEEmitter } from '../sse.js';

/**
 * 注册 SSE 事件流路由
 *
 * GET /api/v1/events — 全局 SSE 持久连接
 */
export function eventsRoute(emitter: SSEEmitter): Hono {
  const app = new Hono();

  app.get('/events', (c) => {
    return streamSSE(c, async (stream) => {
      // 发送初始心跳，确认连接
      await stream.writeSSE({ data: '{"type":"connected"}' });

      // 注册事件监听
      const unsubscribe = emitter.addListener(async (event) => {
        await stream.writeSSE({ data: JSON.stringify(event) });
      });

      // 等待连接关闭
      stream.onAbort(() => {
        unsubscribe();
      });

      // 保持连接：定期发心跳
      while (true) {
        await stream.sleep(30_000);
        await stream.writeSSE({ event: 'ping', data: '' });
      }
    });
  });

  return app;
}
