import { useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chat-store';
import type { SSEEvent } from '@storyweaver/core';

/**
 * 全局 SSE 连接 Hook
 *
 * 连接 GET /api/v1/events，解析 agent:start/token/complete/error 事件，
 * 驱动 chat-store 的 streaming 状态。应在 AppLayout 中调用一次。
 */
export function useChatSSE() {
  const esRef = useRef<EventSource | null>(null);
  const retries = useRef(0);
  const { startStream, appendStreamToken, completeStream, setStreamError } = useChatStore();

  useEffect(() => {
    function connect() {
      const es = new EventSource('/api/v1/events');
      esRef.current = es;

      es.onopen = () => {
        retries.current = 0;
      };

      es.onmessage = (e) => {
        let event: SSEEvent;
        try {
          event = JSON.parse(e.data);
        } catch {
          return;
        }

        switch (event.type) {
          case 'agent:start':
            startStream(event.data.agent);
            break;
          case 'agent:token':
            appendStreamToken(event.data.token);
            break;
          case 'agent:complete':
            completeStream(event.data.messageId ?? `temp-${Date.now()}`);
            break;
          case 'error':
            if (event.data.recoverable) {
              setStreamError(event.data.message);
            }
            break;
        }
      };

      es.onerror = () => {
        es.close();
        const delay = Math.min(1000 * 2 ** retries.current, 30_000);
        retries.current += 1;
        setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [startStream, appendStreamToken, completeStream, setStreamError]);
}
