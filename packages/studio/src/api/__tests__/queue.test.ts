import { describe, it, expect } from 'vitest';
import { AIOperationQueue } from '../queue.js';

describe('AIOperationQueue', () => {
  it('should execute operations sequentially', async () => {
    const queue = new AIOperationQueue();
    const order: number[] = [];

    await Promise.all([
      queue.enqueue(async () => { order.push(1); }),
      queue.enqueue(async () => { order.push(2); }),
      queue.enqueue(async () => { order.push(3); }),
    ]);

    expect(order).toEqual([1, 2, 3]);
  });

  it('should return results from enqueue', async () => {
    const queue = new AIOperationQueue();

    const result = await queue.enqueue(async () => 42);
    expect(result).toBe(42);
  });

  it('should not break chain on rejection', async () => {
    const queue = new AIOperationQueue();
    const order: number[] = [];

    const p1 = queue.enqueue(async () => {
      throw new Error('fail');
    });
    const p2 = queue.enqueue(async () => {
      order.push(1);
      return 'ok';
    });

    await expect(p1).rejects.toThrow('fail');
    const result = await p2;
    expect(result).toBe('ok');
    expect(order).toEqual([1]);
  });

  it('should track isIdle state', async () => {
    const queue = new AIOperationQueue();
    expect(queue.isIdle).toBe(true);

    let resolve: () => void;
    const p = queue.enqueue(() => new Promise<void>((r) => { resolve = r; }));

    // 等一微任务让 enqueue 内部开始执行
    await Promise.resolve();
    expect(queue.isIdle).toBe(false);

    resolve!();
    await p;
    expect(queue.isIdle).toBe(true);
  });
});
