import { describe, it, expect } from 'vitest';
import { createServer } from '../server.js';

describe('createServer', () => {
  it('should return app, sseEmitter, and aiQueue', () => {
    const { app, sseEmitter, aiQueue } = createServer();

    expect(app).toBeDefined();
    expect(sseEmitter).toBeDefined();
    expect(aiQueue).toBeDefined();
  });

  it('should respond to health check', async () => {
    const { app } = createServer();
    const res = await app.request('/api/v1/health');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('should have SSEEmitter with zero listeners', () => {
    const { sseEmitter } = createServer();
    expect(sseEmitter.listenerCount).toBe(0);
  });

  it('should have idle AIOperationQueue', () => {
    const { aiQueue } = createServer();
    expect(aiQueue.isIdle).toBe(true);
  });

  it('should return fileWatcher instance', () => {
    const { fileWatcher } = createServer();
    expect(fileWatcher).toBeDefined();
  });
});
