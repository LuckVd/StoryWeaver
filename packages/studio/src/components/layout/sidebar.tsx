import { NavLink } from 'react-router';
import { Home, BookOpen, MessageSquare, Settings, Network, Search, FileText, Brain, ListTree, Package, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';

const navItems = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/chapters', label: '章节', icon: BookOpen },
  { to: '/outline', label: '大纲', icon: ListTree },
  { to: '/workspace', label: '工作区', icon: Package },
  { to: '/chat', label: 'AI 对话', icon: MessageSquare },
  { to: '/knowledge', label: '知识库', icon: Network },
  { to: '/summaries', label: '章节摘要', icon: FileText },
  { to: '/memory', label: 'AI 记忆', icon: Brain },
  { to: '/search', label: '搜索', icon: Search },
  { to: '/settings', label: '设置', icon: Settings },
];

export function Sidebar() {
  const { theme, toggle } = useTheme();
  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-lg font-semibold">StoryWeaver</span>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-2">
        <button
          onClick={toggle}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === 'dark' ? '浅色模式' : '深色模式'}
        </button>
      </div>
    </aside>
  );
}
