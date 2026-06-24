import { Outlet } from 'react-router';
import { Sidebar } from './sidebar';
import { useChatSSE } from '@/hooks/use-chat-sse';

/**
 * 全局布局:Sidebar + 内容区。
 */
export function AppLayout() {
  useChatSSE();

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
