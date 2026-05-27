import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppLayout } from '@/components/layout/app-layout';
import { DashboardPage } from '@/pages/dashboard';
import { ChaptersPage } from '@/pages/chapters';
import { ChapterEditPage } from '@/pages/chapter-edit';
import { ChatPage } from '@/pages/chat';
import { SettingsPage } from '@/pages/settings';
import { NotFoundPage } from '@/pages/not-found';

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'chapters', element: <ChaptersPage /> },
      { path: 'chapters/:id', element: <ChapterEditPage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
