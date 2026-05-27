import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { errorHandler, APIError } from '../error-handler.js';
import { ErrorCode } from '@storyweaver/core';

describe('errorHandler', () => {
  function createApp() {
    const app = new Hono();
    app.onError(errorHandler);

    app.get('/api-error', () => {
      throw new APIError(ErrorCode.VALIDATION_ERROR, 'Invalid input');
    });

    app.get('/api-error-with-details', () => {
      throw new APIError(ErrorCode.NOT_FOUND, 'Not found', { id: 123 });
    });

    app.get('/generic-error', () => {
      throw new Error('Something broke');
    });

    app.get('/ok', (c) => c.json({ ok: true }));

    return app;
  }

  it('should handle APIError with correct status', async () => {
    const app = createApp();
    const res = await app.request('/api-error');

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Invalid input');
  });

  it('should include details when provided', async () => {
    const app = createApp();
    const res = await app.request('/api-error-with-details');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.details).toEqual({ id: 123 });
  });

  it('should handle generic errors as 500', async () => {
    const app = createApp();
    const res = await app.request('/generic-error');

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('Something broke');
  });

  it('should pass through successful responses', async () => {
    const app = createApp();
    const res = await app.request('/ok');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
