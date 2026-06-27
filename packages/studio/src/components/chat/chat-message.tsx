import type { ChatMessage as ChatMessageType } from '@storyweaver/core';
import { cn } from '@/lib/utils';
import { Seal } from '@/components/ui/seal';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3 px-4 py-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <Seal variant="filled" shape="round" className="h-8 w-8 shrink-0 text-xs [transform:none]">AI</Seal>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'border-l-2 border-l-vermilion bg-muted',
        )}
      >
        {!isUser && message.agent && (
          <div className="mb-1 font-heading text-xs font-medium text-vermilion/80">{message.agent}</div>
        )}
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-xs font-bold text-primary-foreground">
          我
        </div>
      )}
    </div>
  );
}
