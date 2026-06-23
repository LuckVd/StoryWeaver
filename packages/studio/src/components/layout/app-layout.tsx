import { Outlet, useNavigate } from 'react-router';
import { Sidebar } from './sidebar';
import { useChatSSE } from '@/hooks/use-chat-sse';
import { Lightbulb, PenLine, CheckCheck } from 'lucide-react';

const QUICK_ACTIONS = [
  { label: '构思', icon: Lightbulb, hint: 'Brainstormer · 发散创意' },
  { label: '续写', icon: PenLine, hint: 'Writer · 续写正文' },
  { label: '审稿', icon: CheckCheck, hint: 'Auditor · 审查章节' },
];

/**
 * 全局布局:Sidebar + 顶部快捷操作条(G06-S04)+ 内容区。
 * 快捷条一键进入 AI 对话(构思/续写/审稿)。
 */
export function AppLayout() {
  useChatSSE();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-2 border-b bg-background/80 px-4 py-2 backdrop-blur">
          <span className="mr-1 text-xs text-muted-foreground">快捷操作</span>
          {QUICK_ACTIONS.map(({ label, icon: Icon, hint }) => (
            <button
              key={label}
              title={hint}
              onClick={() => navigate('/chat')}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
