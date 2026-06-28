import { createHashRouter, RouterProvider, Navigate } from 'react-router';
import { ErrorBoundary } from '@/components/error-boundary';
import { AppLayout } from '@/components/layout/app-layout';
import { DashboardPage } from '@/pages/dashboard';
import { LibraryPage } from '@/pages/library';
import { ChaptersPage } from '@/pages/chapters';
import { ChapterEditPage } from '@/pages/chapter-edit';
import { ReviewPage } from '@/pages/review';
import { ChatPage } from '@/pages/chat';
import { SettingsPage } from '@/pages/settings';
import { KnowledgePage } from '@/pages/knowledge';
import { SummariesPage } from '@/pages/summaries';
import { SearchPage } from '@/pages/search';
import { MemoryPage } from '@/pages/memory';
import { OutlinePage } from '@/pages/outline';
import { NotFoundPage } from '@/pages/not-found';

// HashRouter:Electron 以 file:// 加载 index.html,BrowserRouter 依 pathname 匹配
// 会落到文件路径 → 404;hash 路由(#/path)不依赖 pathname,桌面应用标准做法。
const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/library" replace /> }, // 启动 → 书架
      { path: 'library', element: <LibraryPage /> },
      { path: 'dashboard', element: <DashboardPage /> }, // 当前书概览(从书架点书进入)
      { path: 'chapters', element: <ChaptersPage /> },
      { path: 'chapters/:id', element: <ChapterEditPage /> },
      { path: 'chapters/:id/review', element: <ReviewPage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'knowledge', element: <KnowledgePage /> },
      { path: 'summaries', element: <SummariesPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'memory', element: <MemoryPage /> },
      { path: 'outline', element: <OutlinePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
