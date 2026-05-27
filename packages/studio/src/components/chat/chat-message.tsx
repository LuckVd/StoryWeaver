import type { ChatMessage as ChatMessageType } from '@storyweaver/core';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3 px-4 py-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          AI
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-2 text-sm',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        {!isUser && message.agent && (
          <div className="mb-1 text-xs font-medium text-muted-foreground">{message.agent}</div>
        )}
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
          我
        </div>
      )}
    </div>
  );
}
