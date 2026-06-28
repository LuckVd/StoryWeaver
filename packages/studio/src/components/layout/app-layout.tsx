import { Outlet } from 'react-router';
import { Sidebar } from './sidebar';
import { TitleBar } from './title-bar';
import { useChatSSE } from '@/hooks/use-chat-sse';

/**
 * 全局布局:自定义标题栏(frame:false)+ Sidebar + 内容区。
 */
export function AppLayout() {
  useChatSSE();

  return (
    <div className="flex h-screen flex-col">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-auto bg-background">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
