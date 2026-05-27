import type { SSEEvent } from '@storyweaver/core';

/**
 * SSE 事件广播器
 *
 * 发布/订阅模式：路由层 emit 事件，SSE 端点注册 listener 推送给客户端。
 */
export class SSEEmitter {
  private listeners = new Set<(event: SSEEvent) => void>();

  /** 广播事件给所有已连接的客户端 */
  emit(event: SSEEvent): void {
    for (const fn of this.listeners) {
      fn(event);
    }
  }

  /**
   * 注册监听器
   * @returns 取消注册函数
   */
  addListener(fn: (event: SSEEvent) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** 当前连接数 */
  get listenerCount(): number {
    return this.listeners.size;
  }
}
