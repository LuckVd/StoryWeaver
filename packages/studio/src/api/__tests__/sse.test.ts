import { describe, it, expect } from 'vitest';
import { SSEEmitter } from '../sse.js';
import type { SSEEvent } from '@storyweaver/core';

describe('SSEEmitter', () => {
  it('should emit events to all listeners', () => {
    const emitter = new SSEEmitter();
    const received: SSEEvent[] = [];

    emitter.addListener((e) => received.push(e));

    const event: SSEEvent = { type: 'agent:start', data: { agent: 'writer', stage: 'generating' } };
    emitter.emit(event);

    expect(received).toEqual([event]);
  });

  it('should support multiple listeners', () => {
    const emitter = new SSEEmitter();
    const a: SSEEvent[] = [];
    const b: SSEEvent[] = [];

    emitter.addListener((e) => a.push(e));
    emitter.addListener((e) => b.push(e));

    const event: SSEEvent = { type: 'error', data: { message: 'test', recoverable: true } };
    emitter.emit(event);

    expect(a).toEqual([event]);
    expect(b).toEqual([event]);
  });

  it('should unsubscribe via returned function', () => {
    const emitter = new SSEEmitter();
    const received: SSEEvent[] = [];

    const unsub = emitter.addListener((e) => received.push(e));
    unsub();

    emitter.emit({ type: 'agent:token', data: { agent: 'writer', token: 'hi' } });
    expect(received).toEqual([]);
  });

  it('should track listener count', () => {
    const emitter = new SSEEmitter();
    expect(emitter.listenerCount).toBe(0);

    const unsub1 = emitter.addListener(() => {});
    emitter.addListener(() => {});
    expect(emitter.listenerCount).toBe(2);

    unsub1();
    expect(emitter.listenerCount).toBe(1);
  });
});
