import { Outlet } from 'react-router';
import { Sidebar } from './sidebar';
import { useChatSSE } from '@/hooks/use-chat-sse';

export function AppLayout() {
  useChatSSE();

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
