import { useEffect, useState } from 'react';
import { useChatStore } from '@/stores/chat-store';
import { ChatPanel } from '@/components/chat/chat-panel';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ChatPage() {
  const {
    sessions,
    currentSession,
    loading,
    fetchSessions,
    createSession,
    fetchSession,
    deleteSession,
  } = useChatStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const filtered = query.trim()
    ? sessions.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
    : sessions;

  const handleNewSession = async () => {
    await createSession({ title: '新对话' });
  };

  const handleSelectSession = async (id: string) => {
    await fetchSession(id);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteSession(id);
  };

  return (
    <div className="flex h-full">
      {/* Session 列表侧栏 */}
      <div className="flex w-60 shrink-0 flex-col border-r bg-sidebar/60">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="font-heading text-sm font-semibold">对话列表</span>
          <Button variant="ghost" size="icon-xs" onClick={handleNewSession} disabled={loading}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="border-b px-3 py-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索对话…"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              {query ? '无匹配对话' : '暂无对话，点击 + 创建'}
            </div>
          )}
          {filtered.map((s) => (
            <div
              key={s.id}
              onClick={() => handleSelectSession(s.id)}
              className={cn(
                'group flex cursor-pointer items-center gap-2 px-3 py-2 font-heading text-sm hover:bg-sidebar-accent/50',
                currentSession?.id === s.id && 'bookmark-bar bg-sidebar-accent/60 font-medium',
              )}
            >
              <span className="flex-1 truncate font-heading">{s.title}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                onClick={(e) => handleDeleteSession(e, s.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* 对话区域 */}
      <div className="flex-1">
        {currentSession ? (
          <ChatPanel />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            选择或创建一个对话
          </div>
        )}
      </div>
    </div>
  );
}
