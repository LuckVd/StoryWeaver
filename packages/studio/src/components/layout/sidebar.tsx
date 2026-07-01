import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { Home, BookOpen, MessageSquare, Settings, Network, Search, FileText, Brain, ListTree, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import { useBookStore } from '@/stores/book-store';
import { Seal } from '@/components/ui/seal';

const navItems = [
  { to: '/dashboard', label: '仪表盘', icon: Home },
  { to: '/chapters', label: '章节', icon: BookOpen },
  { to: '/outline', label: '大纲', icon: ListTree },
  { to: '/chat', label: 'AI 对话', icon: MessageSquare },
  { to: '/knowledge', label: '知识库', icon: Network },
  { to: '/summaries', label: '摘要', icon: FileText },
  { to: '/memory', label: 'AI 记忆', icon: Brain },
  { to: '/search', label: '搜索', icon: Search },
  { to: '/settings', label: '设置', icon: Settings },
];

export function Sidebar() {
  const { theme, toggle } = useTheme();
  const { fetchBook } = useBookStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchBook();
  }, [fetchBook]);

  return (
    <aside className="flex h-full w-56 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Seal variant="filled" className="h-6 w-6 text-[0.6rem]">墨</Seal>
        <span className="font-heading text-lg font-bold tracking-wide">StoryWeaver</span>
      </div>

      {/* 书架入口:点击进入书架切换/新建(书名显示在顶部标题栏) */}
      <button
        onClick={() => navigate('/library')}
        className="mx-2 mt-2 flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 text-left transition-colors hover:bg-sidebar-accent/50"
      >
        <Seal variant="filled" className="h-5 w-5 shrink-0 text-[0.5rem]">架</Seal>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-sm font-medium text-sidebar-foreground">书架</span>
          <span className="block font-heading text-[0.65rem] text-sidebar-foreground/50">管理 / 切换书籍</span>
        </span>
      </button>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 font-heading text-sm transition-colors',
                isActive
                  ? 'bookmark-bar bg-sidebar-accent/60 font-medium text-sidebar-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={toggle}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 font-heading text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === 'dark' ? '浅色模式' : '深色模式'}
        </button>
      </div>
    </aside>
  );
}
