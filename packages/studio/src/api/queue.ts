/**
 * AI 操作串行队列
 *
 * 同一时间只允许一个 AI 操作执行，其他排队等待（FIFO）。
 * 设计约束：同一时间只允许一个 AI 操作，其他排队。
 */
export class AIOperationQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private activeCount = 0;

  /**
   * 将异步操作加入队列，串行执行
   * @returns 操作结果
   */
  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      this.activeCount++;
      try {
        return await fn();
      } finally {
        this.activeCount--;
      }
    };

    const next = this.tail.then(() => run());
    this.tail = next.catch(() => {
      /* 防止链断裂 */
    });
    return next;
  }

  /** 是否空闲（无正在执行的操作） */
  get isIdle(): boolean {
    return this.activeCount === 0;
  }
}
