import { useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chat-store';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { Button } from '@/components/ui/button';
import { X, Check, Replace } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@storyweaver/core';

interface ChatPanelProps {
  chapterId?: number;
  onClose?: () => void;
  embedded?: boolean;
}

export function ChatPanel({ chapterId, onClose, embedded }: ChatPanelProps) {
  const {
    currentSession,
    isStreaming,
    streamingText,
    streamingAgent,
    loading,
    error,
    fetchSessions,
    createSession,
    setCurrentSession,
    sendMessage,
    applyMessage,
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize: find or create a session for this chapter
  useEffect(() => {
    async function init() {
      if (chapterId) {
        await fetchSessions();
        const existing = useChatStore.getState().sessions.find(
          (s) => s.chapterId === chapterId,
        );
        if (existing) {
          setCurrentSession(existing);
        } else {
          await createSession({ chapterId, title: `章节 ${chapterId} 对话` });
        }
      } else if (!currentSession) {
        await createSession({ title: '新对话' });
      }
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages, streamingText]);

  const handleSend = async (message: string) => {
    if (!currentSession) return;
    await sendMessage(currentSession.id, message);
  };

  const handleApply = async (messageId: string, mode: 'append' | 'replace') => {
    if (!currentSession || !chapterId) return;
    await applyMessage(currentSession.id, messageId, chapterId, mode);
  };

  // 判断 session 是否与当前章节匹配，不匹配时显示 loading 避免旧数据闪现
  const sessionReady = !chapterId || currentSession?.chapterId === chapterId;
  const messages = sessionReady ? (currentSession?.messages ?? []) : [];

  // The last assistant message displayed during streaming
  const lastAssistantIdx = [...messages].map((m, i) => ({ m, i }))
    .filter(({ m }) => m.role === 'assistant')
    .pop();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <span className="text-sm font-semibold">
          {currentSession?.title ?? '对话'}
        </span>
        {isStreaming && streamingAgent && (
          <span className="text-xs text-muted-foreground">
            {streamingAgent} 正在生成…
          </span>
        )}
        <div className="flex-1" />
        {onClose && (
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto">
        {!sessionReady && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            加载中…
          </div>
        )}
        {sessionReady && messages.length === 0 && !isStreaming && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            发送消息开始对话
          </div>
        )}
        {messages.map((msg) => {
          const isLastAssistant =
            lastAssistantIdx !== undefined && msg.id === lastAssistantIdx.m.id;
          const showApply = isLastAssistant && embedded && chapterId && !isStreaming;

          return (
            <div key={msg.id}>
              <ChatMessage message={msg} />
              {showApply && (
                <div className="flex gap-2 px-4 pb-2">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleApply(msg.id, 'append')}
                  >
                    <Check className="mr-1 h-3 w-3" />
                    追加到章节
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleApply(msg.id, 'replace')}
                  >
                    <Replace className="mr-1 h-3 w-3" />
                    替换章节内容
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {/* Streaming text */}
        {isStreaming && streamingText && (
          <ChatMessage
            message={{
              id: 'streaming',
              role: 'assistant',
              content: streamingText,
              createdAt: new Date().toISOString(),
              agent: streamingAgent ?? undefined,
            } as ChatMessageType}
          />
        )}

        {isStreaming && !streamingText && (
          <div className="px-4 py-2 text-sm text-muted-foreground">思考中…</div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="border-t bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Loading indicator */}
      {loading && !isStreaming && (
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">加载中…</div>
      )}

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
